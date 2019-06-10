# localserver

Simple express server implementation for private usage

```sh
$ npm i
$ npm start
```

You can change your default under `settings.json`

## HTTPS ##
1. Generate local `key` and `cert` files
2. Update the files path under `settings.json`

On OSX use this command for generating the certificate files:

```bash
openssl req -x509 -sha256 -nodes -newkey rsa:2048 -days 365 -keyout localhost.key -out localhost.crt
```
