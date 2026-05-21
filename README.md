# localserver

## Branch note

The `public` content on the `master` branch is not the production version of the old app.
The currently deployed old app was updated directly on the `gh-pages` branch.

Simple express server implementation for private usage

```sh
$ npm i
$ npm start
```

## New app

The modern replacement app lives under `app/`.

```sh
cd app
npm install
npm run dev
```

The Vite dev server is configured for `http://localhost:3000` so it can use the same local Google OAuth origin as the old app.
Run either the old Express server or the new Vite server on port 3000, not both at the same time.

Production deployment builds `app/` from `master` and copies the static output into `/app` on the `gh-pages` branch.
The deploy workflow only replaces `gh-pages/app` and preserves the old deployed app as the fallback.

You can change your default under `settings.json`

## HTTPS ##
1. Generate local `key` and `cert` files
2. Update the files path under `settings.json`

On OSX use this command for generating the certificate files:

```bash
openssl req -x509 -sha256 -nodes -newkey rsa:2048 -days 365 -keyout localhost.key -out localhost.crt
```
