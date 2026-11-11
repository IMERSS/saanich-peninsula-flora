// Hamburger menu for mobile navigation - overrides that of the hextra theme, themes/hextra/assets/js/menu.js, in the
// bundle written by src/js/themeAssets.js. The theme's assumes that every page holds the sidebar and its overlay. A page
// without them, e.g. the story page, whose layout layouts/story/baseof.html holds the navbar but no sidebar, is given a
// dropdown of the subnav's own menu links instead, which narrow screens otherwise hide - see imerss-story.css

"use strict";

document.addEventListener("DOMContentLoaded", function () {
    const menu = document.querySelector(".hamburger-menu");
    const overlay = document.querySelector(".mobile-menu-overlay");
    const sidebarContainer = document.querySelector(".sidebar-container");

    if (menu && overlay && sidebarContainer) {
        // Initialize the overlay
        const overlayClasses = ["hx-fixed", "hx-inset-0", "hx-z-10", "hx-bg-black/80", "dark:hx-bg-black/60"];
        overlay.classList.add("hx-bg-transparent");
        overlay.classList.remove("hx-hidden", ...overlayClasses);

        const toggleMenu = function () {
            // Toggle the hamburger menu
            menu.querySelector("svg").classList.toggle("open");

            // When the menu is open, we want to show the navigation sidebar
            sidebarContainer.classList.toggle("max-md:[transform:translate3d(0,-100%,0)]");
            sidebarContainer.classList.toggle("max-md:[transform:translate3d(0,0,0)]");

            // When the menu is open, we want to prevent the body from scrolling
            document.body.classList.toggle("hx-overflow-hidden");
            document.body.classList.toggle("md:hx-overflow-auto");
        };

        menu.addEventListener("click", (e) => {
            e.preventDefault();
            toggleMenu();

            if (overlay.classList.contains("hx-bg-transparent")) {
                // Show the overlay
                overlay.classList.add(...overlayClasses);
                overlay.classList.remove("hx-bg-transparent");
            } else {
                // Hide the overlay
                overlay.classList.remove(...overlayClasses);
                overlay.classList.add("hx-bg-transparent");
            }
        });

        overlay.addEventListener("click", (e) => {
            e.preventDefault();
            toggleMenu();

            // Hide the overlay
            overlay.classList.remove(...overlayClasses);
            overlay.classList.add("hx-bg-transparent");
        });
    } else if (!sidebarContainer && !window.imerssSubnavDropdown) {
        // Installed once only, since a page may load this script more than once, and a second listener would close the
        // dropdown as soon as the first had opened it
        window.imerssSubnavDropdown = true;
        // No sidebar - the button opens a dropdown of the links of the subnav, copied beneath it. The story page renders
        // its subnav only once it has loaded, and may render it afresh, so clicks are caught by the document, and the
        // dropdown is built on the first click into whichever subnav then holds the button
        const subnavOf = button => button.closest(".imerss-subnav");
        const dropdownOf = subnav => {
            let dropdown = subnav.querySelector(".imerss-subnav-dropdown");
            if (!dropdown) {
                dropdown = document.createElement("div");
                dropdown.className = "imerss-subnav-dropdown";
                subnav.querySelectorAll("nav > a:not(.imerss-subnav-icon)").forEach(link => dropdown.appendChild(link.cloneNode(true)));
                subnav.appendChild(dropdown);
            }
            return dropdown;
        };
        const setOpen = (subnav, open) => {
            subnav.classList.toggle("imerss-subnav-open", open);
            const button = subnav.querySelector(".hamburger-menu");
            button?.setAttribute("aria-expanded", String(open));
            button?.querySelector("svg")?.classList.toggle("open", open);
        };
        const closeAll = () => document.querySelectorAll(".imerss-subnav-open").forEach(subnav => setOpen(subnav, false));
        document.addEventListener("click", e => {
            const button = e.target.closest?.(".hamburger-menu");
            const subnav = button && subnavOf(button);
            if (subnav) {
                e.preventDefault();
                dropdownOf(subnav);
                setOpen(subnav, !subnav.classList.contains("imerss-subnav-open"));
            } else if (!e.target.closest?.(".imerss-subnav-dropdown")) {
                // Closed by a click or tap anywhere outside it
                closeAll();
            }
        });
        document.addEventListener("keydown", e => {
            if (e.key === "Escape") {
                closeAll();
            }
        });
    }
});
