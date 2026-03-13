# Contributing

### Run

```
npm start -- --branch 6.1 --repo backport-org/backport-demo --all
```

**Run `backport` CLI globally**
This will build backport continously and link it, so it can accessed with `backport` command globally

```
npm run build && chmod +x bin/backport && npm link && npx tsc --watch
```

**Remove linked backport**

```
npm uninstall -g backport; npm unlink;
```

You can now use `backport` command anywhere, and it'll point to the development version.

### Debug

**Run tests**

```
npm test
```

**Run tests continously**

```
npm test -- --watch
```

**Compile typescript continously**

```
npx tsc --watch
```
