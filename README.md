# ymultirepo
Local package manager. A small tool to help manage your multi-repo work.

# What is multi-repo? Why not mono repo?
Not mine article but I totally agree with it
https://medium.com/@PepsRyuu/monorepos-in-javascript-anti-pattern-917603da59c8

# Requirements
For now ymultirepo works with `pnpm` package manager only.

# Installation - step 1: globally, one time
1. Projects that consume local modules should have `ymultirepo` installed to node_modules. So
- `pnpm i -g ymultirepo` **AND** set `NODE_PATH` to global modules folder (recommended). 
    You can use the following snippet to set NODE_PATH permanently on Windows:


```bat
pnpm config get prefix > node_path.txt
setx NODE_PATH < node_path.txt
erase node_path.txt
echo %NODE_PATH%
```

* **OR**

- Just use `pnpm i ymultirepo --saveDev` in each consumer (**not** recommended, because this would force all contributors to install `ymultirepo` even when they don't use it)

2. Use `pnpm config` to set `local_packages_folder` to the folder where you store your projects:

        pnpm config set local_packages_folder YOUR_PATH_TO_PROJECTS_FOLDER

# Installation - step 2: in each project

3. Add `pnpmfile.js` to your project root with contents

```javascript
const {ymultirepoRemap} = require("../local_packages_list");
function readPackage (pkg, context) {
    ymultirepoRemap(pkg);
    if (pkg.dependencies)
        for(let k in resolutions)
            if(pkg[k])
                pkg[k] = resolutions[k];
    return pkg
};

```

If you already using `pnpmfile.js` for some other needs, than just add a call to `remapLocal(package, context)` at the top of readPackage handler.

# Usage

4. Now you can add/install packages normally with  `pnpm i`. If **ymultirepo** sees that package is installed locally it will use local one instead of remote one.
5. You can use `YOUR_PATH_TO_PROJECTS_FOLDER/local_packages_list.json` to change this behavior for some packages when you wish to.
6. After each change you'll have to do `pnpm i` inside each depended project.

# Policies

When you have many projects it's usually convenient to have same config for all of them. I've made **[yproject_policy](https://www.npmjs.com/package/yproject_policy)** package to handle this problem. This package lets you define policies, verify and fix multiple projects with the policy.

# Uninstallation

If you didn't liked **ymultirepo** uninstallation process is quite simple.

- `pnpm uninstall -g ymultirepo ` (or  `pnpm uninstall ymultirepo ` if you installed it locally)
- delete `pnpminit.js` file in your projects

# Functions (Developer guide)

* `caseInsensitiveCompare(a, b)` - case insensitive string comparision
* `getLocalPackagesPathsObj()` - reads setting from `npm config`
* `writeFileSyncIfChanged(fileName, content, encoding = "utf-8")` - writes file only if supplied content differs from existing content
* `getLocalPackagesList(localPackagesPaths = getLocalPackagesPathsObj())` - reads `local_packages_list.json` to object.
* `ymultirepoScan(localPackagesPaths = getLocalPackagesPathsObj())` - scans folders set by setup(1) and refreshes `local_packages_list.json`
* `getLocalPackages(localPackagesPaths = getLocalPackagesPathsObj())` - reads `local_packages_list.json` and makes effective set of local packages in packageName -> package form
* `ymultirepoRemap(p, context, effectiveLocalPackages = getLocalPackages())` - a convinien function to use with `pnpmfile.js`
    * **TODO** Maybe package version should also be checked inside `remapLocal`.



# TODOs and notes

* **TODO** Maybe package version should also be checked inside `remapLocal`.
* **Note** ***Installation - step 1 & 2*** doesn't seem as a good solution to me. But I haven't found any other way. That would be great if all this gets implemented as a part of **pnpm** someday
        
         




