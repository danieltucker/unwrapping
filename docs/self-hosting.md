# Self-hosting Unwrap on TrueNAS

Unwrap is a single Node process and a single SQLite file, so hosting it is
mostly a question of where that file lives and who is allowed to write to it.

Everything below assumes TrueNAS SCALE 24.10 (Electric Eel) or newer, which runs
apps on Docker. The image and the compose file are ordinary Docker, so the same
instructions work on any machine with Docker installed.

## What you need to decide first

| | |
|---|---|
| **A dataset for the data** | The database and every uploaded gift photo live in one directory. Make a dataset for it, e.g. `tank/apps/unwrap`. Everything else in the container is disposable. |
| **The address people will use** | `SITE_URL`. It goes into share links, link previews and canonical URLs, and it decides whether cookies are marked `Secure`. Over plain http on your LAN, say `http://nas.local:3000`, not `https://…`, or signing in will appear to do nothing. |
| **A session secret** | `SESSION_SECRET`, any long random string. Changing it later signs everyone out and orphans guest reservations, so generate it once and keep it: `node -e "console.log(crypto.randomBytes(32).toString('hex'))"` |

## Option A: build it on the NAS (recommended)

The Apps UI can install a compose file but it cannot build an image, and there
is no published image for Unwrap yet. Building on the box itself is the shortest
path and needs no registry account.

SSH in as a user who can run `docker`, then:

```bash
# A dataset you created for this, not inside /root.
cd /mnt/tank/apps/unwrap

git clone <your remote> app
cd app

cp .env.example .env
# Fill in SESSION_SECRET and SITE_URL. DATABASE_URL is set by the image.
nano .env

docker compose up -d --build
```

The first build takes a few minutes; after that `docker compose up -d --build`
is how you deploy a change. Check it came up with:

```bash
docker compose ps        # should say healthy after ~20 seconds
docker compose logs -f
```

Then open `http://<nas-address>:3000`.

The compose file bind-mounts `./data`, so the database ends up inside the
checkout at `/mnt/tank/apps/unwrap/app/data`. If you would rather keep data and
code apart, which makes snapshots and a `git pull` independent of each other,
change the volume to an absolute path:

```yaml
volumes:
  - /mnt/tank/apps/unwrap/data:/app/data
```

### Permissions

The container runs as uid 1001, not root, so the data directory has to be
writable by uid 1001. If the logs show `SQLITE_CANTOPEN` or `EACCES`, this is
why:

```bash
chown -R 1001:1001 /mnt/tank/apps/unwrap/data
```

A dataset created with POSIX ACLs (the "Apps" preset) is easiest here. If you
use NFSv4 ACLs, grant uid 1001 full control on the dataset instead.

## Option B: push an image, install from the Apps UI

Use this if you want Unwrap listed alongside your other apps with the usual
TrueNAS controls, or if you would rather not build on the NAS.

On a machine with Docker, build for the NAS's architecture (TrueNAS SCALE is
x86-64; an Apple Silicon or Windows-on-ARM laptop is not, hence `--platform`):

```bash
docker buildx build --platform linux/amd64 -t ghcr.io/<you>/unwrap:latest --push .
```

Then in **Apps → Discover → Custom App**, or the YAML installer if your version
offers one:

- **Image**: `ghcr.io/<you>/unwrap:latest`
- **Port**: container `3000` to whatever host port you like
- **Environment**: `SESSION_SECRET`, `SITE_URL`
- **Storage**: host path `/mnt/tank/apps/unwrap/data` mounted at `/app/data`

The image already sets `NODE_ENV`, `HOSTNAME`, `PORT` and `DATABASE_URL`; leave
those alone unless you are changing the port, in which case set `PORT` to match.

## Reaching it from outside the house

Put it behind a reverse proxy that terminates TLS: Nginx Proxy Manager and
Traefik both exist as TrueNAS apps, and either is a better front door than
exposing the Node process directly. Then set `SITE_URL` to the https address and
restart, so cookies get their `Secure` flag back and share links stop pointing
at a LAN name nobody outside can resolve.

Two things to know before you open it up:

- **Anyone who can reach the sign-up page can make an account.** There is no
  invite gate. Set `ADMIN_EMAILS` to your own address and restart to get
  `/admin`, which lists every account, list and uploaded photo on the instance
  and can delete any of them. It is the only way to remove someone short of
  editing the database, and there is no undo. Leave it unset and the screen 404s
  for everybody, which is the right setting for an instance you are not
  moderating.
- **There is no password reset.** Nothing sends email yet, so a forgotten
  password means editing the database by hand. Use a password manager.

## Backups

Everything that matters is in the data directory: `app.db`, its `-wal` and
`-shm` companions, and `uploads/`.

A TrueNAS periodic snapshot task on the dataset is the right answer. SQLite is in
WAL mode, so a file copy taken while the app is writing can be a valid database
that is missing the last few seconds. For a copy you can trust, stop the
container first:

```bash
docker compose stop
cp -a data /mnt/tank/backups/unwrap-$(date +%F)
docker compose start
```

## Upgrading

```bash
cd /mnt/tank/apps/unwrap/app
git pull
docker compose up -d --build
```

Pending migrations are applied when the new container starts, before it serves
anything. There is no rollback, so take a snapshot first if the release includes
a migration you have not seen run.

## When something is wrong

| Symptom | Cause |
|---|---|
| Sign-in does nothing, no error | `SITE_URL` says `https://` but you are reaching it over `http://`, so the browser is dropping a `Secure` cookie. |
| `SQLITE_CANTOPEN`, `EACCES` on boot | The data directory is not writable by uid 1001. See Permissions above. |
| Link previews and share links show the wrong address | `SITE_URL` is unset or stale. It defaults to the public domain, which is wrong for your instance. |
| Container restarts in a loop | Read the logs first: `docker compose logs`. A missing `SESSION_SECRET` is the usual answer, and it fails loudly on purpose. |
| Won't start, read-only filesystem error | Comment out `read_only: true` in `docker-compose.yml` and open an issue with the path it complained about. |
| Pasting a shop link finds nothing | The container needs outbound internet access to read product pages. It does not need anything inbound. Then read the scrape log below, which says which of the two it was. |

## When a shop link won't fill in

Every attempt to read a product page writes one line to the server log, whether
it worked or not:

```bash
docker compose logs -f | grep "\[scrape\]"
```

```
[scrape] ok dur=2306ms host=amazon.com status=200 bytes=2862145 title=site markup price=site markup/4999 images=site markup/1 url=https://www.amazon.com/dp/B0DCN2KVKV
[scrape] blocked dur=430ms host=example-shop.com cause=ECONNRESET url=https://www.example-shop.com/p/...
[scrape] challenged dur=892ms host=rei.com status=200 bytes=2827 title=none price=none/none images=none/0 url=https://www.rei.com/product/...
```

The first word is what happened. `ok` means we read the page; `title=`, `price=`
and `images=` then name the markup each field came out of, so `title=og:title
price=none/none` says the shop publishes a title and no price rather than that
we failed to look. Anything else is the shop, not the parser:

| Outcome | What it means |
|---|---|
| `blocked` | The shop dropped the connection before answering. Bot protection at their edge — it refuses the connection itself, so no header or user agent changes it. The gift has to be written in by hand, and the form says so. |
| `challenged` | It answered `200`, but with an "are you a robot" interstitial instead of the product — Akamai, Cloudflare, PerimeterX, DataDome, or Amazon's own captcha page. Reading it would mean running the challenge's JavaScript and passing its behavioural checks, which no parser change reaches. Reported rather than filled in half-wrong: the interstitial has a title and sometimes an image, and putting either on a card would be worse than leaving it blank. REI and Best Buy are both this. See [referrals-and-product-data.md](referrals-and-product-data.md) for the way round it. |
| `timeout` | No answer in 8 seconds. Worth one retry; a shop that stalls every time is refusing us politely. |
| `http-error` | It answered with a status, not a page. `403`/`429` is being turned away, `404` is usually a link that has expired. |
| `unreachable` | DNS, TLS or the network — check the container has outbound access. |
| `no-link` | Nothing in what was pasted parsed as an address. |

To work on one yourself, run the same code path from a checkout:

```bash
npm run scrape -- "https://www.example.com/p/thing"
```

That prints the whole trace and what the Add a gift form would be filled in
with. `SCRAPE_DEBUG=1` additionally logs the full trace as JSON and keeps each
page body under `data/scrapes/`, which you can then re-parse offline as many
times as you like without going back to the shop:

```bash
node scripts/test-parse.mts data/scrapes/1758…-example.com.html "https://www.example.com/p/thing"
```

Parsing itself lives in `src/lib/scrape-parse.ts`, and it is pure — no network,
no framework — so a new shop is a selector and a test case.

## What this setup does not do

No email of any kind, no payments, and no OAuth sign-in. Cash gifts and group
gifts show guests the payment details you type in and the money goes directly to
you; nothing moves through the app. See the README for the current state of that.
