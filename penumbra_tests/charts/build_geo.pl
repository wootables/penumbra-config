use strict; use warnings;
use JSON::PP;
use POSIX qw(floor);

# =============================================================================
# Build js/penumbra_geo_us.js from the us-atlas TopoJSON files.
#
# Everything expensive happens HERE, once, offline:
#   TopoJSON -> absolute lon/lat -> Albers USA -> simplify -> normalise to a
#   0..1000 box -> flat [x,y,x,y,...] rings.
#
# The runtime therefore does no projection maths at all - it scales a
# pre-projected path to the canvas. That is what lets the outline map ship
# without vendoring d3-geo (~100 KB) for one chart type.
# =============================================================================

my ($statesFile, $countiesFile, $worldFile, $isoFile, $outFile) = @ARGV;
die "usage: build_geo.pl <states-10m.json> <counties-10m.json> <countries-50m.json> <iso-countries.json> <out.js>\n" unless $outFile;

sub slurp_json {
    my ($p) = @_;
    open(my $fh, "<", $p) or die "open $p: $!";
    binmode $fh; local $/; my $raw = <$fh>; close $fh;
    return decode_json($raw);
}

# ---- TopoJSON arc decoding -------------------------------------------------
# Arcs are delta-encoded and quantised; the topology's transform turns them
# back into lon/lat.
sub decode_arcs {
    my ($topo) = @_;
    my ($sx, $sy) = @{ $topo->{transform}{scale} };
    my ($tx, $ty) = @{ $topo->{transform}{translate} };
    my @out;
    for my $arc (@{ $topo->{arcs} }) {
        my ($x, $y) = (0, 0);
        my @pts;
        for my $d (@$arc) {
            $x += $d->[0]; $y += $d->[1];
            push @pts, [ $x * $sx + $tx, $y * $sy + $ty ];
        }
        push @out, \@pts;
    }
    return \@out;
}

# A ring is a list of arc indices; a negative index ~i means arc i reversed.
sub ring_points {
    my ($arcs, $ringIdx) = @_;
    my @pts;
    for my $ai (@$ringIdx) {
        my ($idx, $rev) = ($ai < 0) ? (-$ai - 1, 1) : ($ai, 0);
        my @a = @{ $arcs->[$idx] };
        @a = reverse @a if $rev;
        # Arcs share endpoints; drop the duplicate joint.
        shift @a if @pts;
        push @pts, @a;
    }
    return \@pts;
}

sub geometry_rings {
    my ($arcs, $geom) = @_;
    my @rings;
    return \@rings unless $geom->{arcs};
    if ($geom->{type} eq 'Polygon') {
        push @rings, ring_points($arcs, $_) for @{ $geom->{arcs} };
    } elsif ($geom->{type} eq 'MultiPolygon') {
        for my $poly (@{ $geom->{arcs} }) {
            push @rings, ring_points($arcs, $_) for @$poly;
        }
    }
    return \@rings;
}

# ---- Albers conic equal-area ----------------------------------------------
# d3's formulation. `rot` is the longitude rotation in degrees; `c` is the
# centre in ALREADY-ROTATED degrees, matching d3's .rotate().center() pairing.
use constant PI => 4 * atan2(1, 1);
sub D2R { $_[0] * PI / 180 }

sub make_albers {
    my (%o) = @_;                      # p1, p2, rot, cx, cy, k, tx, ty
    my ($p1, $p2) = (D2R($o{p1}), D2R($o{p2}));
    my $sp1 = sin($p1);
    my $n   = ($sp1 + sin($p2)) / 2;
    my $C   = 1 + $sp1 * (2 * $n - $sp1);
    my $r0  = sqrt($C) / $n;
    my $raw = sub {
        my ($lamDeg, $phiDeg) = @_;
        my $lam = D2R($lamDeg);
        my $phi = D2R($phiDeg);
        my $inner = $C - 2 * $n * sin($phi);
        $inner = 0 if $inner < 0;       # guard the pole side of the cone
        my $r = sqrt($inner) / $n;
        return ($r * sin($lam * $n), $r0 - $r * cos($lam * $n));
    };
    my ($ox, $oy) = $raw->($o{cx}, $o{cy});
    return sub {
        my ($lon, $lat) = @_;
        my ($x, $y) = $raw->($lon + $o{rot}, $lat);
        return ($o{tx} + $o{k} * ($x - $ox),
                $o{ty} - $o{k} * ($y - $oy));
    };
}

# ---- Equal Earth (Savric, Patterson & Jenny 2018) ---------------------------
# The world layer gets this rather than a conic: it is EQUAL-AREA, which is the
# whole point of a choropleth (shade must mean value, not latitude), and unlike
# Albers it is designed to show the entire globe without the polar smear of
# Mercator or the area lies of Robinson. Closed form, so it is a few lines here
# and nothing at all in the browser.
sub asin_safe {
    my ($x) = @_;
    $x =  1 if $x >  1;
    $x = -1 if $x < -1;
    return atan2($x, sqrt(1 - $x * $x));
}
sub make_equal_earth {
    my (%o) = @_;                      # k, tx, ty
    my ($A1, $A2, $A3, $A4) = (1.340264, -0.081106, 0.000893, 0.003796);
    my $M = sqrt(3) / 2;
    return sub {
        my ($lonDeg, $latDeg) = @_;
        my $lam = D2R($lonDeg);
        my $phi = D2R($latDeg);
        my $th  = asin_safe($M * sin($phi));
        my $t2  = $th * $th;
        my $t6  = $t2 * $t2 * $t2;
        my $den = $M * ($A1 + 3 * $A2 * $t2 + $t6 * (7 * $A3 + 9 * $A4 * $t2));
        my $x   = $lam * cos($th) / $den;
        my $y   = $th * ($A1 + $A2 * $t2 + $t6 * ($A3 + $A4 * $t2));
        # minus on y: the box is screen-oriented (y grows DOWNWARD), same as
        # make_albers returns.
        return ($o{tx} + $o{k} * $x, $o{ty} - $o{k} * $y);
    };
}
# Equal Earth spans x +/-2.707 and y +/-1.317 in projection units, so k=185
# puts the world at ~1000 units across - the same order as the other layers,
# which keeps the Douglas-Peucker tolerances comparable.
my $WORLD_PROJ = make_equal_earth(k => 185, tx => 500, ty => 250);

# d3.geoAlbersUsa's composite, with its published sub-projection placements.
my $K = 1070;                 # d3's default scale
my $TX = 480; my $TY = 250;   # d3's default translate

my $LOWER48 = make_albers(p1 => 29.5, p2 => 45.5, rot => 96,  cx => -0.6, cy => 38.7,
                          k => $K,        tx => $TX,               ty => $TY);
my $ALASKA  = make_albers(p1 => 55,   p2 => 65,   rot => 154, cx => -2,   cy => 58.5,
                          k => $K * 0.35, tx => $TX - 0.307 * $K,  ty => $TY + 0.201 * $K);
my $HAWAII  = make_albers(p1 => 8,    p2 => 18,   rot => 157, cx => -3,   cy => 19.9,
                          k => $K,        tx => $TX - 0.205 * $K,  ty => $TY + 0.212 * $K);
# Puerto Rico is not in d3's albersUsa at all (it falls outside every clip
# extent). Given as its own inset here, tucked under Florida, because research
# awards to PR institutions are real and dropping them silently would be worse
# than a slightly unconventional map.
my $PRICO   = make_albers(p1 => 8,    p2 => 18,   rot => 66,  cx => 0,    cy => 18.2,
                          k => $K,        tx => $TX + 0.235 * $K,  ty => $TY + 0.220 * $K);

# North Carolina gets its OWN conic, and must: drawing NC in the lower-48
# Albers (central meridian -96) leaves it visibly CROOKED. A conic rotates a
# region by (lambda - lambda0) * sin(phi0), and NC sits ~16 deg east of -96,
# which works out to ~9.7 deg - measured 9.9 deg of tilt on the state northern
# border in the first shipped build, and that border is a straight line of
# latitude in reality. The standard NC parallels (34 20' / 36 10') on a -79
# central meridian put the state upright. Only the nc-counties layer uses this;
# us-outline stays on the composite, where Albers USA is the right choice.
my $NC      = make_albers(p1 => 34.3333, p2 => 36.1667, rot => 79, cx => 0, cy => 35.25,
                          k => $K,        tx => $TX,               ty => $TY);

my %PROJ_BY_FIPS = ('02' => $ALASKA, '15' => $HAWAII, '72' => $PRICO);
# d3.geoAlbersUsa CLIPS each inset, and that clip is not cosmetic: without it
# Alaska's Aleutian chain runs west past the antimeridian, the normalise step
# scales the whole composite down to fit it, and the lower 48 end up small and
# pushed right. Rings lying entirely outside their projection's extent are
# dropped - which is exactly the set d3 would have clipped away.
my %CLIP_BY_FIPS = (
    '02' => [ $TX - 0.425 * $K, $TY + 0.120 * $K, $TX - 0.214 * $K, $TY + 0.234 * $K ],
    '15' => [ $TX - 0.214 * $K, $TY + 0.166 * $K, $TX - 0.115 * $K, $TY + 0.234 * $K ],
    '72' => [ $TX + 0.200 * $K, $TY + 0.195 * $K, $TX + 0.280 * $K, $TY + 0.245 * $K ],
);
my $CLIP_LOWER48 = [ $TX - 0.455 * $K, $TY - 0.238 * $K, $TX + 0.455 * $K, $TY + 0.238 * $K ];
# Territories with no inset: excluded from the outline map on purpose (see the
# help text). The tile grid remains the option that shows all of them.
my %SKIP_FIPS = map { $_ => 1 } qw(60 66 69 78);

# Largest ring of a feature, used as the last-resort keep for a country that
# simplified away entirely.
sub null_biggest {
    my ($rings) = @_;
    my $best;
    for my $r (@$rings) { $best = $r if !$best || @$r > @$best; }
    return $best;
}

# ---- Douglas-Peucker -------------------------------------------------------
sub dp {
    my ($pts, $tol) = @_;
    return $pts if @$pts < 3;
    my @keep = (0) x scalar(@$pts);
    $keep[0] = $keep[$#$pts] = 1;
    my @stack = ([0, $#$pts]);
    while (@stack) {
        my ($a, $b) = @{ pop @stack };
        next if $b <= $a + 1;
        my ($ax, $ay) = @{ $pts->[$a] };
        my ($bx, $by) = @{ $pts->[$b] };
        my $dx = $bx - $ax; my $dy = $by - $ay;
        my $den = $dx * $dx + $dy * $dy;
        my ($best, $bestD) = (-1, -1);
        for my $i ($a + 1 .. $b - 1) {
            my ($px, $py) = @{ $pts->[$i] };
            my $d;
            if ($den == 0) {
                $d = ($px - $ax) ** 2 + ($py - $ay) ** 2;
            } else {
                my $t = (($px - $ax) * $dx + ($py - $ay) * $dy) / $den;
                $t = 0 if $t < 0; $t = 1 if $t > 1;
                my $qx = $ax + $t * $dx; my $qy = $ay + $t * $dy;
                $d = ($px - $qx) ** 2 + ($py - $qy) ** 2;
            }
            if ($d > $bestD) { $bestD = $d; $best = $i; }
        }
        if ($bestD > $tol * $tol) {
            $keep[$best] = 1;
            push @stack, [$a, $best], [$best, $b];
        }
    }
    return [ map { $pts->[$_] } grep { $keep[$_] } 0 .. $#$pts ];
}

# ---- Build one layer -------------------------------------------------------
sub build_layer {
    my (%o) = @_;   # topo, object, filter, projFor, tol, minRingPts, label
    my $topo = $o{topo};
    my $arcs = decode_arcs($topo);
    my @feats;
    my $rawPts = 0; my $keptPts = 0;

    for my $g (@{ $topo->{objects}{ $o{object} }{geometries} }) {
        my $id = $g->{id} // '';
        next unless $o{filter}->($id, $g);
        my $proj = $o{projFor}->($id);
        my $clip = $o{clipFor} ? $o{clipFor}->($id) : undef;
        my $rings = geometry_rings($arcs, $g);
        my @outRings;
        for my $r (@$rings) {
            $rawPts += scalar @$r;
            my @proj = map { my ($x, $y) = $proj->(@$_); [$x, $y] } @$r;
            if ($clip) {
                my ($cx0, $cy0, $cx1, $cy1) = @$clip;
                my ($mnx, $mny, $mxx, $mxy) = (1e18, 1e18, -1e18, -1e18);
                for my $p (@proj) {
                    $mnx = $p->[0] if $p->[0] < $mnx; $mxx = $p->[0] if $p->[0] > $mxx;
                    $mny = $p->[1] if $p->[1] < $mny; $mxy = $p->[1] if $p->[1] > $mxy;
                }
                next if $mxx < $cx0 || $mnx > $cx1 || $mxy < $cy0 || $mny > $cy1;
            }
            my $s = dp(\@proj, $o{tol});
            # Drop slivers: a 3-point ring is a degenerate island at this scale.
            next if @$s < $o{minRingPts};
            $keptPts += scalar @$s;
            push @outRings, $s;
        }
        # A whole COUNTRY simplifying away is a different thing from a sliver
        # island being dropped: Malta and Singapore vanished entirely, which
        # reads as a hole in the map and makes their rows unmatchable. If a
        # feature kept nothing, take its largest ring at full detail instead.
        # Only ever fires for features that are tiny anyway, so it costs a
        # handful of points, not a bigger file.
        if (!@outRings && $o{keepTiny}) {
            my $big = null_biggest($rings);
            if ($big && @$big >= 3) {
                my @proj = map { my ($x, $y) = $proj->(@$_); [$x, $y] } @$big;
                $keptPts += scalar @proj;
                push @outRings, \@proj;
            }
        }
        next unless @outRings;
        push @feats, { id => $id, name => $g->{properties}{name}, rings => \@outRings };
    }
    printf STDERR "  %-12s %3d features, %6d -> %6d points (%.0f%% kept)\n",
        $o{label}, scalar(@feats), $rawPts, $keptPts, $rawPts ? 100 * $keptPts / $rawPts : 0;
    return \@feats;
}

# ---- Normalise a layer into a 0..1000 box, aspect preserved ---------------
sub normalise {
    my ($feats) = @_;
    my ($minX, $minY, $maxX, $maxY) = (1e18, 1e18, -1e18, -1e18);
    for my $f (@$feats) { for my $r (@{ $f->{rings} }) { for my $p (@$r) {
        $minX = $p->[0] if $p->[0] < $minX; $maxX = $p->[0] if $p->[0] > $maxX;
        $minY = $p->[1] if $p->[1] < $minY; $maxY = $p->[1] if $p->[1] > $maxY;
    } } }
    my $w = $maxX - $minX; my $h = $maxY - $minY;
    my $s = 1000 / ($w > $h ? $w : $h);
    for my $f (@$feats) {
        my @flat;
        for my $r (@{ $f->{rings} }) {
            push @flat, [ map { ( sprintf('%.1f', ($_->[0] - $minX) * $s) + 0,
                                  sprintf('%.1f', ($_->[1] - $minY) * $s) + 0 ) } @$r ];
        }
        $f->{flat} = \@flat;
    }
    return { w => sprintf('%.1f', $w * $s) + 0, h => sprintf('%.1f', $h * $s) + 0 };
}

# ---- Emit ------------------------------------------------------------------
sub feat_js {
    my ($f, $extra) = @_;
    my @rings = map { '[' . join(',', @$_) . ']' } @{ $f->{flat} };
    my $j = JSON::PP->new->canonical;
    return '{id:' . $j->encode($f->{id}) .
           ',name:' . $j->encode($f->{name}) .
           ($extra // '') .
           ',rings:[' . join(',', @rings) . ']}';
}

print STDERR "decoding + projecting:\n";

my $stTopo = slurp_json($statesFile);
my $states = build_layer(
    topo => $stTopo, object => 'states', label => 'states', tol => 0.55, minRingPts => 5,
    filter  => sub { my ($id) = @_; !$SKIP_FIPS{$id} },
    projFor => sub { my ($id) = @_; $PROJ_BY_FIPS{$id} || $LOWER48 },
    clipFor => sub { my ($id) = @_; $CLIP_BY_FIPS{$id} || $CLIP_LOWER48 },
);
my $stBox = normalise($states);

my $coTopo = slurp_json($countiesFile);
my $counties = build_layer(
    topo => $coTopo, object => 'counties', label => 'NC counties', tol => 0.35, minRingPts => 4,
    filter  => sub { my ($id) = @_; substr($id, 0, 2) eq '37' },
    projFor => sub { $NC },
);
my $coBox = normalise($counties);

# ---- World countries -------------------------------------------------------
# Antarctica is dropped: it has no awards, and on an equal-area world map it
# eats the bottom fifth of the canvas. Five features in countries-50m carry no
# ISO numeric id in the atlas - Somaliland, Kosovo, N. Cyprus, Indian Ocean Ter.
# and Siachen Glacier - so they get a synthetic one; they still DRAW (leaving a
# hole where land is would read as a bug), they simply can never be matched to
# a value.
my $wTopo = slurp_json($worldFile);
my $synth = 0;
my $world = build_layer(
    topo => $wTopo, object => 'countries', label => 'world', tol => 0.4, minRingPts => 4, keepTiny => 1,
    filter  => sub { my ($id, $g) = @_;
                     return 0 if ($g->{properties}{name} // '') eq 'Antarctica';
                     return 1; },
    projFor => sub { $WORLD_PROJ },
);
for my $wf (@$world) {
    next if defined $wf->{id} && $wf->{id} =~ /^\d+$/;
    $wf->{id} = 'x' . (++$synth);          # unmatched-by-design
}
my $wBox = normalise($world);

# ---- ISO 3166-1 lookup -----------------------------------------------------
# The warehouse stores country NAMES, not codes ("United States", and
# US-government inverted forms like "Korea, South"), but other tables use
# codes - so every key resolves to the same ISO numeric the atlas uses as its
# feature id. Keys are normalised to A-Z0-9 only.
# FOLD accented letters to ASCII before stripping - do not just delete them.
# "Cote d'Ivoire" typed in a warehouse is plain ASCII, while ISO spells it
# "Cote d'Ivoire" with a circumflex; deleting the accent gives CTEDIVOIRE and
# the two never meet. Folding gives COTEDIVOIRE from both.
my %FOLD = (
    "\x{C0}"=>'A',"\x{C1}"=>'A',"\x{C2}"=>'A',"\x{C3}"=>'A',"\x{C4}"=>'A',"\x{C5}"=>'A',"\x{C6}"=>'AE',
    "\x{C7}"=>'C',"\x{C8}"=>'E',"\x{C9}"=>'E',"\x{CA}"=>'E',"\x{CB}"=>'E',
    "\x{CC}"=>'I',"\x{CD}"=>'I',"\x{CE}"=>'I',"\x{CF}"=>'I',"\x{D0}"=>'D',"\x{D1}"=>'N',
    "\x{D2}"=>'O',"\x{D3}"=>'O',"\x{D4}"=>'O',"\x{D5}"=>'O',"\x{D6}"=>'O',"\x{D8}"=>'O',
    "\x{D9}"=>'U',"\x{DA}"=>'U',"\x{DB}"=>'U',"\x{DC}"=>'U',"\x{DD}"=>'Y',"\x{DE}"=>'TH',"\x{DF}"=>'SS',
    "\x{152}"=>'OE',"\x{160}"=>'S',"\x{17D}"=>'Z',"\x{178}"=>'Y',"\x{141}"=>'L',
);
sub norm_key {
    my ($x) = @_;
    $x = uc($x // '');
    $x =~ s/(.)/exists $FOLD{$1} ? $FOLD{$1} : $1/ge;
    $x =~ s/[^A-Z0-9]//g;
    return $x;
}
# Long-form names carry a qualifier the warehouse usually drops: ISO calls it
# "Republic of Cabo Verde" where a report just says "Cabo Verde". Strip a
# LEADING qualifier and index that too. Deterministic - no per-country data.
my @QUALIFIERS = (
    'THEUNITEDREPUBLICOF', 'THEDEMOCRATICREPUBLICOF', 'THEFEDERALREPUBLICOF',
    'THEISLAMICREPUBLICOF', 'THEPEOPLESREPUBLICOF', 'THEBOLIVARIANREPUBLICOF',
    'THEPLURINATIONALSTATEOF', 'THEINDEPENDENTSTATEOF', 'THECOOPERATIVEREPUBLICOF',
    'UNITEDREPUBLICOF', 'DEMOCRATICREPUBLICOF', 'FEDERALREPUBLICOF', 'ISLAMICREPUBLICOF',
    'PEOPLESREPUBLICOF', 'BOLIVARIANREPUBLICOF', 'PLURINATIONALSTATEOF',
    'INDEPENDENTSTATEOF', 'COOPERATIVEREPUBLICOF', 'GRANDDUCHYOF', 'PRINCIPALITYOF',
    'COMMONWEALTHOF', 'SULTANATEOF', 'KINGDOMOF', 'STATEOF', 'REPUBLICOF', 'THE',
);
sub strip_qualifier {
    my ($k) = @_;
    for my $q (@QUALIFIERS) {
        return substr($k, length($q)) if index($k, $q) == 0 && length($k) > length($q) + 2;
    }
    return '';
}
my $iso = slurp_json($isoFile);
my %KEYS;
sub add_key {
    my ($k, $id) = @_;
    $k = norm_key($k);
    return if $k eq '' || length($k) > 40;
    $KEYS{$k} = $id unless exists $KEYS{$k};   # first writer wins: ISO beats an alias
    my $bare = strip_qualifier($k);
    $KEYS{$bare} = $id if $bare ne '' && !exists $KEYS{$bare};
    # Also index the form with the filler words dropped. The warehouse holds
    # "Congo, Democratic Republic", whose comma-swap is DEMOCRATICREPUBLICCONGO,
    # while ISO spells it "Democratic Republic of the Congo". Dropping OF/THE
    # makes those meet - and the two Congos stay distinct
    # (DEMOCRATICREPUBLICCONGO vs REPUBLICCONGO), which a looser rule would not.
    my $filler = $k;
    $filler =~ s/(?:OF|THE)//g;
    $KEYS{$filler} = $id if $filler ne '' && length($filler) > 3 && !exists $KEYS{$filler};
}
# Only ids the atlas can actually draw are worth a key.
my %DRAWABLE = map { $_->{id} => 1 } @$world;
for my $c (@$iso) {
    my $n3 = $c->{ccn3} // '';
    next unless $n3 ne '' && $DRAWABLE{$n3};
    add_key($n3, $n3);
    add_key($c->{cca2}, $n3);
    add_key($c->{cca3}, $n3);
    add_key($c->{name}{common},   $n3);
    add_key($c->{name}{official}, $n3);
    for my $alt (@{ $c->{altSpellings} || [] }) {
        # Skip non-Latin spellings: they cannot appear in this warehouse and
        # would only bloat the file.
        next if $alt =~ /[^\x20-\x7E]/;
        add_key($alt, $n3);
    }
    # US-government / CIA style inverted names ("Korea, South") are what this
    # warehouse actually holds, and no ISO field lists them. Derive them by
    # swapping around the comma rather than hand-listing countries.
    for my $nm ($c->{name}{common}, $c->{name}{official}) {
        next unless defined $nm;
        my @w = split /\s+/, $nm;
        next unless @w >= 2;
        add_key($w[-1] . ' ' . join(' ', @w[0 .. $#w - 1]), $n3);
    }
}
# The atlas's own Natural Earth short names ("W. Sahara", "Dem. Rep. Congo") -
# and their comma-swapped forms too. The warehouse holds "Congo, Dem. Rep.",
# which no ISO field lists and which only the ATLAS name swaps onto.
for my $wf (@$world) {
    next unless $wf->{id} =~ /^\d+$/;
    add_key($wf->{name}, $wf->{id});
    my @w = split /\s+/, ($wf->{name} // '');
    add_key($w[-1] . ' ' . join(' ', @w[0 .. $#w - 1]), $wf->{id}) if @w >= 2;
}
# The UK's constituent countries are recorded by name in this warehouse
# ("England", "Scotland") and are not ISO entries, so nothing above matches
# them. They are unambiguously part of GBR - this is a fact, not a guess - and
# leaving them in the unmatched pile helps nobody. GBR's numeric id is read
# from the ISO data rather than hard-coded.
{
    my ($gb) = grep { ($_->{cca3} // '') eq 'GBR' } @$iso;
    my $gbId = $gb ? $gb->{ccn3} : '';
    if ($gbId ne '' && $DRAWABLE{$gbId}) {
        add_key($_, $gbId) for ('England', 'Scotland', 'Wales', 'Northern Ireland', 'Great Britain');
    }
}
printf STDERR "  %-12s %3d countries, %d lookup keys\n", 'iso keys', scalar(@$world), scalar(keys %KEYS);

open(my $O, ">", $outFile) or die "write $outFile: $!";
binmode $O;
my $hdr = <<'HDR';
/*!
 * penumbra_geo_us.js - pre-projected map boundaries for the vis() map chart.
 *
 * GENERATED - do not hand-edit. Rebuild with penumbra_tests/charts/build_geo.pl
 * from the TopoJSON sources in penumbra_tests/charts/geo_src.
 *
 * SOURCE      us-outline, nc-counties: us-atlas v3 (states-10m, counties-10m),
 *             which repackages US Census Bureau TIGER/Line cartographic
 *             boundaries.
 *             world: world-atlas (countries-50m), which repackages Natural
 *             Earth 1:50m admin-0 countries.
 *             Census and Natural Earth data are public domain; the atlas
 *             packaging is ISC-licensed.
 *             COUNTRY_KEYS maps warehouse country NAMES onto the ISO 3166-1
 *             numeric ids the atlas uses as world feature ids, built from
 *             geo_src/iso-countries.json plus the atlas's own short names.
 * PROJECTION  Applied HERE at build time, one projection per LAYER.
 *             us-outline: Albers USA composite - lower 48 in Albers conic
 *             equal-area, with Alaska (0.35x), Hawaii and Puerto Rico as insets
 *             at d3.geoAlbersUsa's published placements.
 *             nc-counties: its OWN Albers, standard NC parallels 34 20' / 36 10'
 *             on a -79 central meridian. It must not reuse the lower-48 conic:
 *             that rotates NC ~10 degrees off true north (a conic rotates by
 *             (lambda - lambda0) * sin(phi0), and NC is ~16 degrees east of -96).
 *             world: Equal Earth (Savric, Patterson & Jenny 2018) on a 0
 *             central meridian. No conic can carry the whole globe, and this
 *             layer has to stay EQUAL-AREA so shade means value and not
 *             latitude - which rules out Mercator's polar smear and Robinson's
 *             area lies alike.
 *             Coordinates are already flat [x,y,x,y,...] in a 0..1000 box, so
 *             the renderer only scales them to the canvas - no projection maths
 *             and no d3-geo dependency ship to the browser.
 * OMITTED     us-outline: American Samoa, Guam, Northern Mariana Islands and
 *             the US Virgin Islands have no inset here and are not drawn. The
 *             us-grid tile map remains the option that shows every territory.
 *             world: Antarctica is dropped - it has no awards, and on an
 *             equal-area projection it eats the bottom fifth of the canvas.
 *             Somaliland, Kosovo, N. Cyprus, Indian Ocean Ter. and Siachen
 *             Glacier carry no ISO numeric id in the atlas, so they take a
 *             synthetic "xN" id: they still DRAW, but can never be matched to
 *             a value.
 *             Values naming anything omitted or unmatched are counted in the
 *             chart's "did not match" note.
 *
 * Loaded lazily by penumbraLoadGeoModule() in main.js, only when a chart with
 * an outline map actually renders.
 */
(function (global) {
    'use strict';

HDR
print $O $hdr;
printf $O "    var STATES_BOX = { w: %s, h: %s };\n", $stBox->{w}, $stBox->{h};
printf $O "    var NC_BOX     = { w: %s, h: %s };\n",   $coBox->{w}, $coBox->{h};
printf $O "    var WORLD_BOX  = { w: %s, h: %s };\n\n", $wBox->{w},  $wBox->{h};

print $O "    var STATES = [\n";
print $O join(",\n", map { '        ' . feat_js($_) } @$states);
print $O "\n    ];\n\n";

print $O "    var NC_COUNTIES = [\n";
print $O join(",\n", map { '        ' . feat_js($_) } @$counties);
print $O "\n    ];\n\n";

print $O "    var WORLD = [\n";
print $O join(",\n", map { '        ' . feat_js($_) } @$world);
print $O "\n    ];\n\n";

# normalised lookup key -> ISO numeric id, wrapped so the file stays readable
{
    my $j = JSON::PP->new->canonical;
    my @pairs = map { $j->encode($_) . ':' . $j->encode($KEYS{$_}) } sort keys %KEYS;
    my ($line, @lines) = ('');
    for my $p (@pairs) {
        if (length($line) + length($p) > 100) { push @lines, $line; $line = ''; }
        $line .= ($line eq '' ? '' : ',') . $p;
    }
    push @lines, $line if $line ne '';
    print $O "    var COUNTRY_KEYS = {\n        ";
    print $O join(",\n        ", @lines);
    print $O "\n    };\n\n";
}

print $O <<'FTR';

    global.PenumbraGeoUS = {
        states:      { box: STATES_BOX, features: STATES },
        ncCounties:  { box: NC_BOX,     features: NC_COUNTIES },
        world:       { box: WORLD_BOX,  features: WORLD },
        countryKeys: COUNTRY_KEYS
    };
})(typeof window !== 'undefined' ? window : this);
FTR
close $O;

my $sz = -s $outFile;
printf STDERR "wrote %s: %d bytes (%d states, %d NC counties, %d countries)\n",
    $outFile, $sz, scalar(@$states), scalar(@$counties), scalar(@$world);
