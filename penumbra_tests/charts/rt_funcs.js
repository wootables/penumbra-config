    function stripWrappingQuotePair(s) {
        if (s == null) return s;
        var str = String(s);
        if (str.length < 2) return str;
        var first = str.charAt(0);
        var last = str.charAt(str.length - 1);
        if ((first === "'" && last === "'") || (first === '"' && last === '"')) {
            return str.slice(1, -1);
        }
        return str;
    }

    /**
     * Drops ONE matched quote pair wrapping an infobox payload - the
     * `raw|"...content..."` form, where the quotes sit AFTER the mode prefix
     * instead of around the whole argument.
     *
     * Both forms have to work. parseFunctionArgs honours either when splitting
     * on commas, so authors reach for the inner form whenever the content holds
     * a comma - and it USED to leak its opening quote into the rendered dialog,
     * because the handlers stripped quotes off the argument BEFORE splitting on
     * the pipe, with a regex that ate the trailing quote and left the leading
     * one (see stripWrappingQuotePair above for that regex's failure mode).
     *
     * Whitespace-tolerant around the pair (`raw| "x"` is the same intent), but
     * the INNER content is returned byte-for-byte: a raw| payload's leading
     * newline and indentation are real HTML whitespace.
     *
     * Twins: the action(infobox…) handler in engine A and the one in engine B
     * (resolveInfoboxSnippet). Engine C (schedule_runner.php) strips action()
     * wholesale for email, so it has no copy of this.
     */
    function stripInfoboxPayloadQuotes(s) {
        if (s == null) return s;
        var str = String(s);
        var trimmed = str.trim();
        var stripped = stripWrappingQuotePair(trimmed);
        return stripped === trimmed ? str : stripped;
    }

    function parseFunctionArgs(argString) {
        const args = [];
        let currentArg = '';
        let parenCount = 0;
        let inQuote = false;
        let quoteChar = '';
        let inGuard = false; // inside a \x02...\x02 pre-formatted-number guard

        for (let i = 0; i < argString.length; i++) {
            const char = argString[i];

            if (char === '\x02') {
                // A guarded number like \x021,234\x02 (round()/fixed() output)
                // is atomic: its thousands comma must not split the argument
                // list of an enclosing call. Twin of parse_format_args in
                // schedule_runner.php.
                inGuard = !inGuard;
            } else if (!inQuote && (char === "'" || char === '"')) {
                inQuote = true;
                quoteChar = char;
            } else if (inQuote && char === quoteChar && argString[i - 1] !== '\\') {
                inQuote = false;
                quoteChar = '';
            } else if (char === '(' && !inQuote) {
                parenCount++;
            } else if (char === ')' && !inQuote) {
                parenCount--;
            }

            if (char === ',' && !inQuote && !inGuard && parenCount === 0) {
                args.push(currentArg.trim());
                currentArg = '';
            } else {
                currentArg += char;
            }
        }
        args.push(currentArg.trim());

        // Final pass to remove the outer quotes (single or double) from arguments that were quoted.
        //
        // Single-quoted args also drop the backslash from \' - the loop above
        // already treated it as an escaped quote, so it is noise once the wrapping
        // quotes are gone, and leaving it in is why a dialog-authored apostrophe
        // used to render as `Sponsor\'s Board`. This was written and reverted once
        // (2026-08-11) because the real apostrophe it delivers then tripped the
        // whole-snippet render abort in the syntax guard; that guard is now a
        // proper quote-aware scan (penumbraSnippetSyntaxLooksComplete) and
        // htmlEncode escapes ' so the engines' own re-scan passes stay sane.
        //
        // Double-quoted args are deliberately left alone: the \" inside an
        // `action(infobox, ..., "raw|...")` payload is load-bearing for the nested
        // re-parse of that payload. Twin of parse_format_args in schedule_runner.php.
        // Strip only when the argument IS one quoted literal - i.e. the first
        // UNESCAPED closing quote is the final character. The old test (first
        // char and last char are the same quote) also fired on an argument that
        // merely begins and ends with quotes, which silently corrupted every
        // quoted case() condition: `'Smith' = 'Smith'` came back as
        // `Smith' = 'Smith`, whose comparison operator is then inside a masked
        // quote span, so safeEvaluate found no operator and returned false -
        // `case('A' = 'A', …)` had never once taken its true branch.
        // This is a strict NARROWING: the only arguments that stop being
        // stripped are the ones the strip was mangling.
        const isWholeQuotedLiteral = (s, qc) => {
            for (let i = 1; i < s.length; i++) {
                if (s.charAt(i) === qc && s.charAt(i - 1) !== '\\') return i === s.length - 1;
            }
            return false;
        };
        return args.map(arg => {
            if (arg.length >= 2) {
                const qc = arg.charAt(0);
                if ((qc === "'" || qc === '"') && isWholeQuotedLiteral(arg, qc)) {
                    const inner = arg.slice(1, -1);
                    return qc === "'" ? inner.replace(/\\'/g, "'") : inner;
                }
            }
            return arg;
        }
        );
    }

