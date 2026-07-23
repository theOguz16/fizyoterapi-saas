# VDS Docker Deploy

This deployment keeps the existing host Nginx as the public reverse proxy. Docker services bind only to `127.0.0.1`, so the firewall can stay limited to `22`, `80`, and `443`.

## Services

- `postgres`: private PostgreSQL 16 container with a named volume.
- `api`: Express API on host `127.0.0.1:5511`, container port `5501`.
- `web`: public marketing/site app on host `127.0.0.1:3939`.
- `admin-web`: admin panel on host `127.0.0.1:2929`.

The mobile app is not deployed as a container. It should keep using `https://api.fizyoflow.com/api` as its production API base.

## First Server Setup

```bash
cd /var/www
git clone git@github.com:YOUR_ORG/YOUR_REPO.git fitnes-saas
cd /var/www/fitnes-saas
cp .env.production.vds.example .env.production
nano .env.production
```

Generate strong secrets on the server:

```bash
openssl rand -base64 48
openssl rand -base64 48
```

Use different values for `JWT_SECRET` and `FIZYOFLOW_ADMIN_SECRET`.

Set `REVENUECAT_REST_API_KEY` to the RevenueCat project secret API key. The API
container uses it to verify purchases immediately when the mobile client calls
the subscription sync endpoint; the webhook remains the asynchronous fallback.

## Build And Start

```bash
docker compose --env-file .env.production -f docker-compose.vds.yml up -d --build
docker compose --env-file .env.production -f docker-compose.vds.yml ps
```

Check the API health endpoints:

```bash
curl -fsS http://127.0.0.1:5511/health
curl -fsS http://127.0.0.1:5511/ready
```

## Nginx

Copy the Nginx template:

```bash
sudo cp ops/nginx-fitnes-saas.conf /etc/nginx/sites-available/fitnes-saas.conf
sudo ln -s /etc/nginx/sites-available/fitnes-saas.conf /etc/nginx/sites-enabled/fitnes-saas.conf
sudo nginx -t
sudo systemctl reload nginx
```

Issue certificates:

```bash
sudo certbot --nginx \
  -d fizyoflow.com \
  -d www.fizyoflow.com \
  -d app.fizyoflow.com \
  -d api.fizyoflow.com
```

DNS must point all domains to the VDS IP:

```txt
fizyoflow.com      A    89.47.113.41
www.fizyoflow.com  A    89.47.113.41
app.fizyoflow.com  A    89.47.113.41
api.fizyoflow.com  A    89.47.113.41
```

## Regular Deploys From GitHub

```bash
cd /var/www/fitnes-saas
git pull --ff-only
docker compose --env-file .env.production -f docker-compose.vds.yml up -d --build
docker compose --env-file .env.production -f docker-compose.vds.yml ps
```

Follow logs:

```bash
docker compose --env-file .env.production -f docker-compose.vds.yml logs -f api
docker compose --env-file .env.production -f docker-compose.vds.yml logs -f web admin-web
```

## Backups

Create database dumps before risky deploys:

```bash
mkdir -p backups
docker compose --env-file .env.production -f docker-compose.vds.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "backups/fitnes-saas-$(date +%F-%H%M).sql"
```

Do not run `docker volume prune` on the server unless the database volume has been verified and backed up.
