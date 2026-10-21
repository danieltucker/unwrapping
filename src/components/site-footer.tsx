/**
 * One footer for every page, rendered once by the root layout like the header.
 *
 * `mt-auto` keeps it on the bottom edge of a short page: the body is a flex
 * column, and on a screen whose content doesn't fill it the margin takes up
 * the slack rather than leaving the footer floating mid-viewport.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-ink-line bg-paper px-[1.375rem] py-5 text-center text-xs text-ink-66 sm:px-8">
      Designed &amp; hosted by{" "}
      <a
        href="https://bellinghamhosting.com"
        className="font-semibold text-ink-76 underline-offset-2 hover:text-ink hover:underline"
      >
        Bellingham Web Design &amp; Hosting
      </a>{" "}
      in Bellingham, WA
    </footer>
  );
}
