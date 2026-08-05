# Kosmos Repositories

This directory contains Git submodules for various repositories.

## Updating Submodules

To pull the latest changes from the submodule repositories:

```bash
# Update all submodules
git submodule update --remote

# Or update a specific submodule
cd repositories/aws-saa-practice-app
git pull origin main
```

## Adding New Submodules

To add a new repository as a submodule:

```bash
git submodule add git@github.com:ORGANIZATION/REPO_NAME.git repositories/REPO_NAME
```

## Making Changes to Submodules

Submodules are separate repositories - you cannot push changes directly from this parent repository. Each submodule is just a pointer to a specific commit in another repository.
