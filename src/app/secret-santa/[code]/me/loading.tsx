/**
 * Shown while a participant's page loads, the heaviest one, with two lists on
 * it: the shape of the card that's coming, so nothing jumps when it arrives.
 * Screen readers are told it's loading rather than handed empty boxes.
 *
 * Only here, not on the invite or the dashboard: under a loading boundary a
 * missing exchange is streamed with a 200 rather than a 404, and the invite
 * link is the URL that gets shared and crawled.
 */
export default function SecretSantaLoading() {
  return (
    <main className="mx-auto w-full max-w-[640px] px-[22px] py-10" aria-busy="true">
      <p role="status" className="sr-only">
        Loading your Secret Santa…
      </p>
      <div
        aria-hidden="true"
        className="overflow-hidden rounded-card border border-ink-line bg-paper shadow-card"
      >
        <div className="bg-ink px-[26px] py-[22px]">
          <div className="mb-3 h-3 w-32 rounded-pill bg-paper-fill" />
          <div className="h-8 w-64 max-w-full rounded-control bg-paper-fill" />
        </div>
        <div className="flex flex-col gap-4 p-[26px]">
          <div className="h-24 animate-pulse rounded-card bg-ink/[.05] motion-reduce:animate-none" />
          <div className="h-4 w-3/4 animate-pulse rounded-pill bg-ink/[.05] motion-reduce:animate-none" />
          <div className="h-4 w-1/2 animate-pulse rounded-pill bg-ink/[.05] motion-reduce:animate-none" />
        </div>
      </div>
    </main>
  );
}
