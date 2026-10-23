import { desc } from "drizzle-orm";
import type { Metadata } from "next";

import {
  deleteAccount,
  dismissReport,
  removeReportedMessage,
  setAdmin,
  setBanned,
} from "@/app/admin/actions";
import { allListRows } from "@/app/admin/queries";
import { AdminActionButton } from "@/components/admin-action-button";
import { AdminDelete } from "@/components/admin-delete";
import { Pill, plural, Row, Section, stamp } from "@/components/admin-ui";
import { Avatar } from "@/components/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isAdmin, isAdminEmail, requireAdmin } from "@/lib/admin";
import { openReports } from "@/lib/secret-santa";

export const metadata: Metadata = { title: "Accounts · Admin" };

/**
 * Who is here, and what to do about them: reported Secret Santa messages
 * first, since those are waiting on somebody, then every account.
 */
export default async function AdminAccountsPage() {
  const me = await requireAdmin();

  const [accounts, allLists, reports] = await Promise.all([
    db.select().from(users).orderBy(desc(users.createdAt)).all(),
    allListRows(),
    openReports(),
  ]);

  /** What each account stands to lose, counted from the same rows the Lists tab draws. */
  const owned = new Map<string, { lists: number; gifts: number }>();
  for (const { list, giftCount } of allLists) {
    if (!list.ownerId) continue;
    const tally = owned.get(list.ownerId) ?? { lists: 0, gifts: 0 };
    tally.lists += 1;
    tally.gifts += giftCount;
    owned.set(list.ownerId, tally);
  }

  return (
    <>
      <Section
        title="Reported Secret Santa messages"
        count={reports.length}
        note="Reporters are never shown"
        empty="Nothing reported. Messages between a Santa and the person they drew land here only if one of them flags it."
      >
        {reports.map((report) => (
          <Row key={report.reportId}>
            <div className="min-w-0 flex-1">
              <p className="whitespace-pre-line break-words text-sm leading-[1.6]">
                {report.removedAt ? <em className="text-ink-62">Already removed.</em> : report.body}
              </p>
              <p className="mt-1 text-xs text-ink-72">
                From {report.senderName} in &ldquo;{report.exchangeName}&rdquo; · reported{" "}
                {stamp(report.reportedAt)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <AdminActionButton
                action={dismissReport}
                fields={{ reportId: report.reportId }}
                label="It's fine"
                busyLabel="Dismissing…"
              />
              <AdminDelete
                action={removeReportedMessage}
                fields={{ messageId: report.messageId }}
                label="Remove"
                prompt="Take this message out of the thread? Both people will see that a message was removed."
                confirmLabel="Remove it"
                busyLabel="Removing…"
              />
            </div>
          </Row>
        ))}
      </Section>

      <Section
        title="Accounts"
        count={accounts.length}
        empty="Nobody has signed up yet."
      >
        {accounts.map((user) => {
          const { lists: listCount, gifts: giftCount } =
            owned.get(user.id) ?? { lists: 0, gifts: 0 };
          const self = user.id === me.id;
          const root = isAdminEmail(user.email);
          const admin = isAdmin(user);

          return (
            <Row key={user.id}>
              <Avatar name={user.name} url={user.avatarUrl} size={36} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">
                  {user.name}
                  {self ? <Pill tone="ink">You</Pill> : null}
                  {admin ? <Pill tone="violet">{root ? "Admin · ADMIN_EMAILS" : "Admin"}</Pill> : null}
                  {user.bannedAt ? <Pill tone="rose">Banned {stamp(user.bannedAt)}</Pill> : null}
                </p>
                <p className="truncate text-xs text-ink-72">{user.email}</p>
                <p className="mt-0.5 truncate text-xs text-ink-62">
                  /lists/{user.handle} · {plural(listCount, "list")} ·{" "}
                  {plural(giftCount, "gift")} · joined {stamp(user.createdAt)}
                </p>
              </div>

              <div className="flex flex-wrap items-start justify-end gap-2">
                {/* ADMIN_EMAILS is the operator's say-so and can't be undone
                    from here; nor can your own access, or a banned account be
                    promoted. setAdmin refuses all three regardless. */}
                {root || user.bannedAt || (self && admin) ? null : (
                  <AdminActionButton
                    action={setAdmin}
                    fields={admin ? { userId: user.id } : { userId: user.id, grant: "on" }}
                    label={admin ? "Remove admin" : "Make admin"}
                    busyLabel="Saving…"
                  />
                )}

                {user.bannedAt ? (
                  <AdminActionButton
                    action={setBanned}
                    fields={{ userId: user.id }}
                    label="Lift ban"
                    busyLabel="Lifting…"
                  />
                ) : self || admin ? null : (
                  <AdminDelete
                    action={setBanned}
                    fields={{ userId: user.id, ban: "on" }}
                    label="Ban"
                    confirmLabel="Ban"
                    busyLabel="Banning…"
                    prompt={`Ban ${user.name}? They're signed out and can't sign back in, and their ${plural(
                      listCount,
                      "list",
                    )} go offline. Nothing is deleted, and lifting the ban puts it all back.`}
                  />
                )}

                {self ? null : (
                  <AdminDelete
                    action={deleteAccount}
                    fields={{ userId: user.id }}
                    label="Delete account"
                    prompt={
                      listCount > 0
                        ? `Delete ${user.name} and ${plural(listCount, "list")} with ${plural(
                            giftCount,
                            "gift",
                          )} on them? Everyone who reserved one of those gifts loses that reservation.`
                        : `Delete ${user.name}? They have no lists.`
                    }
                  />
                )}
              </div>
            </Row>
          );
        })}
      </Section>
    </>
  );
}
