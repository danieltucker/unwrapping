import { CopyButton } from "@/components/copy-button";
import { CapsLabel } from "@/components/ui";

/**
 * Everything to do with getting the link to people, in one block.
 *
 * Used twice: as the second step of creating a list, and behind the editor's
 * Share button. One component, so the link is never explained two ways.
 *
 * The QR arrives as rendered SVG because it is generated on the server.
 */
export function SharePanel({
  shareUrl,
  canonical,
  qrSvg,
}: {
  shareUrl: string;
  /** Where the short link lands; worth showing, since it isn't the same string. */
  canonical: string;
  qrSvg: string;
}) {
  return (
    <>
      <CapsLabel className="mb-[7px]">Your link</CapsLabel>
      <div className="mb-[9px] flex items-center gap-[10px] rounded-control border border-ink-line-strong bg-surface px-[13px] py-[11px]">
        <span className="min-w-0 flex-1 truncate font-mono text-sm font-medium text-ink/82">
          {shareUrl.replace(/^https?:\/\//, "")}
        </span>
        <CopyButton value={shareUrl} label="Copy link" />
      </div>
      <p className="mb-[18px] text-xs leading-[1.6] text-ink-66">
        Short and easy to read out. It opens{" "}
        <span className="font-mono">{canonical}</span>.
      </p>

      <div className="grid grid-cols-[auto_1fr] gap-[10px]">
        <div className="rounded-[12px] border border-ink-line bg-surface p-4 text-center">
          <div
            className="mx-auto mb-[10px] h-24 w-24 [&>svg]:h-full [&>svg]:w-full"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="text-xs font-semibold">Scan to open</p>
        </div>
        <div className="flex flex-col justify-center gap-2 rounded-[12px] border border-ink-line bg-surface p-4">
          <p className="text-xs font-semibold text-ink-62">Invite by email</p>
          <p className="text-2xs leading-[1.5] text-ink-62">
            Coming later. Send the link yourself for now.
          </p>
        </div>
      </div>
    </>
  );
}
