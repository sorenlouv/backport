If you don't have git or Node.js installed locally, you can run `backport` via Docker.
The easiest way is to add the following bash function to your bash profile, and update `BACKPORT_FOLDER` and `GITCONFIG` if needed.

```sh
backport() {
    BACKPORT_FOLDER=~/.backport
    GITCONFIG=~/.gitconfig

    docker run -it --rm -v $(pwd):/app:ro -v $BACKPORT_FOLDER:/root/.backport -v $GITCONFIG:/etc/gitconfig sqren/backport "$@"
}
```

You can now use `backport` as if it was installed locally.
