# Using the docker image

### Running the published image

```
docker run -it --rm -v $(pwd):/app:ro -v ~/.backport:/root/.backport sqren/backport "$@"
```

### Running from source

```
yarn docker-run
```

# Development

### Build docker image

```
docker build -t sqren/backport .
```

### Test image locally before publishing:

```
docker run -it --rm -v $(pwd):/app:ro -v ~/.backport:/root/.backport sqren/backport "$@"
```

### Publish to Docker hub

```
docker push sqren/backport
```

## Authenticate with docker hub

```
docker login
```

A personal access token can be created [here](https://hub.docker.com/settings/security)
