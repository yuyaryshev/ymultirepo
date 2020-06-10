# ymultirepo
Local package manager. A small tool to help manage your multi-repo work.

# What is multi-repo? Why not mono repo?
Not mine article but I totally agree with it
https://medium.com/@PepsRyuu/monorepos-in-javascript-anti-pattern-917603da59c8

# Requirements
For now ymultirepo works with `pnpm` package manager only.

# Setup
1. Projects that consume local modules should have `ymultirepo` installed to node_modules. So
- `npm i -g ymultirepo` **AND** set `NODE_PATH` to global modules folder (recommended). 
    You can use the following snippet to set NODE_PATH permanently on Windows:


```bat
npm config get prefix > node_path.txt
setx /m /p NODE_PATH= < node_path.txt
setx NODE_PATH %NODE_PATH% /m
erase node_path.txt
```

* **OR**

- Just use `npm i ymultirepo --saveDev` in each consumer (**not** recommended, because this would force all contributors to install `ymultirepo` even when they don't use it)

2. Use `npm config` to set `local_packages_folder` to the folder where you store your projects:

        npm config set local_packages_folder YOUR_PATH_TO_PROJECTS_FOLDER

3. Add `pnpminit.js` to your project root with contents

    ```javascript
    const {ymultirepoRemap, ymultirepoScan} = require('ymultirepo');
    ymultirepoScan(); // This line refreshes YOUR_PATH_TO_PROJECTS_FOLDER/local_packages_list.json
    module.exports = {
        hooks: {
            readPackage:ymultirepoRemap,
        },
    };
    ```

    If you already using `pnpmfile.js` for some other needs, than just add a call to `remapLocal(package, context)` at the top of readPackage handler.

4. Use `YOUR_PATH_TO_PROJECTS_FOLDER/local_packages_list.json` to fine tune which local packages you want/don't want to use for the moment.


# Functions (Developer guide)

* `caseInsensitiveCompare(a, b)` - case insensitive string comparision
* `getLocalPackagesPathsObj()` - reads setting from `npm config`
* `writeFileSyncIfChanged(fileName, content, encoding = "utf-8")` - writes file only if supplied content differs from existing content
* `getLocalPackagesList(localPackagesPaths = getLocalPackagesPathsObj())` - reads `local_packages_list.json` to object.
* `ymultirepoScan(localPackagesPaths = getLocalPackagesPathsObj())` - scans folders set by setup(1) and refreshes `local_packages_list.json`
* `getLocalPackages(localPackagesPaths = getLocalPackagesPathsObj())` - reads `local_packages_list.json` and makes effective set of local packages in packageName -> package form/ 
* `ymultirepoRemap(p, context, effectiveLocalPackages = getLocalPackages())` - a convinien function to use with `pnpmfile.js`
    * **TODO** Maybe package version should also be checked inside `remapLocal`.

# TODOs and notes

* **TODO** Maybe package version should also be checked inside `remapLocal`.
* **Note** ***Setup.1*** doesn't seem as a good solution to me. But I haven't found any other way. That would be great if all this gets implemented as a part of **pnpm** someday
        
         




