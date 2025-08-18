document.addEventListener('DOMContentLoaded', () => {
    const logo = document.getElementById("logo");
    const textLogo = document.getElementById("text-logo");
    const path = document.querySelector(".preloader-path");

    path.addEventListener("animationend", () => {
        logo.classList.add("pulsing");
        textLogo.classList.add("visible");
        textLogo.classList.add("pulsing");

        const content = {
            title: "Coming Soon".split(''),
            desc: "We have quietly launched with our private network with a number of our flagship events and will be launching for everyone in the coming weeks. In the meantime, have fun playing with our Hot Air Balloons...".split('')
        };

        const container = $("#text-animation-container");

        // Clear previous content and render static centered blocks ready for scramble
        container.html(`
            <div class="letters-wrap mutable">
                <div class="soup-title"></div>
                <div class="soup-desc"></div>
            </div>
        `);

        const mutableWrap = container.find('.mutable');
        const mutableTitle = mutableWrap.find(".soup-title");
        const mutableDesc = mutableWrap.find(".soup-desc");

    const createScrambleSpans = (textArr) => {
            const frag = $(document.createDocumentFragment());
            textArr.forEach(ch => {
        const span = $('<span class="scramble-char" />').text(ch);
                frag.append(span);
            });
            return frag;
        };

        // Populate with final text (centered), then perform scramble animation in place
        mutableTitle.empty().append(createScrambleSpans(content.title));
        mutableDesc.empty().append(createScrambleSpans(content.desc));

        // Scrambler
        const scramble = ($nodes, finalChars, opts = {}) => {
            const symbols = opts.symbols || '!<>-_\\/[]{}—=+*^?#________';
            const duration = opts.duration || 900;
            const stagger = opts.stagger || 8; // ms between character starts
            const easing = opts.easing || ((t) => t);
            const scrambleColor = opts.scrambleColor || null; // optional temporary color during scramble
            const finalColor = opts.finalColor || null;       // optional final color override

            const startTime = performance.now();
            const schedule = [];
            for (let i = 0; i < $nodes.length; i++) {
                const start = i * stagger;
                const end = start + duration;
                schedule.push({ start, end, final: finalChars[i] });
            }

            const tick = (now) => {
                const elapsed = now - startTime;
                for (let i = 0; i < $nodes.length; i++) {
                    const node = $nodes[i];
                    const s = schedule[i];
                    const finalCh = s.final;
                    const isSpace = finalCh === ' ' || finalCh === '\u00A0';
                    if (elapsed >= s.end) {
                        node.textContent = finalCh;
                        if (finalColor) node.style.color = finalColor;
                    } else if (elapsed >= s.start) {
                        const p = easing(Math.min(1, (elapsed - s.start) / (s.end - s.start)));
                        // swap random chars more frequently at the beginning
                        if (!isSpace && Math.random() < (1 - p) * 0.8 + 0.1) {
                            node.textContent = symbols[Math.floor(Math.random() * symbols.length)];
                            if (scrambleColor) node.style.color = scrambleColor;
                        } else if (isSpace) {
                            node.textContent = finalCh; // keep spacing stable
                        }
                    }
                }
                if (elapsed < schedule[schedule.length - 1].end) {
                    requestAnimationFrame(tick);
                } else {
                    // ensure final text
                    for (let i = 0; i < $nodes.length; i++) {
                        $nodes[i].textContent = finalChars[i];
                        if (finalColor) $nodes[i].style.color = finalColor;
                    }
                }
            };
            requestAnimationFrame(tick);
        };

        const titleNodes = mutableTitle.find('.scramble-char').toArray();
        const descNodes = mutableDesc.find('.scramble-char').toArray();

        // Start scramble after fonts (for consistent metrics)
        const startScramble = () => {
            // Use a gentle ease-in-out for a slower perceived pace
            const easeInOut = (t) => t * t * (3 - 2 * t);

            // Title uses its CSS color (palette highlight)
            scramble(titleNodes, content.title, { duration: 1500, stagger: 35, easing: easeInOut });
            // Subheader scrambles in a darker palette color, then resolves to the existing light text color
            scramble(
                descNodes,
                content.desc,
                {
                    duration: 2200,
                    stagger: 14,
                    easing: easeInOut,
                    scrambleColor: getComputedStyle(document.documentElement).getPropertyValue('--color-dark-2').trim() || '#2b6373',
                    finalColor: 'rgba(240, 250, 251, 0.9)'
                }
            );
        };
        if (document.fonts && document.fonts.status !== 'loaded') {
            document.fonts.ready.then(startScramble);
        } else {
            startScramble();
        }
    });
});
