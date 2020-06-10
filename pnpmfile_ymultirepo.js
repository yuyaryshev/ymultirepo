import { join as joinPath, resolve as resolvePath } from "path";
import { readdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { execSync } from "child_process";
import fs from "fs";

let localPackagesPaths;
let localPackagesList;
let effectiveLocalPackages;

export function caseInsensitiveCompare(a, b) {
    if (typeof a === "string") a = a.toLowerCase();
    if (typeof b === "string") b = b.toLowerCase();
    return a < b ? -1 : a > b ? 1 : 0;
}

export function getLocalPackagesPathsObj() {
    if(!localPackagesPaths) {
        const paths = execSync('npm config get local_packages_folders',{encoding:"utf-8"})
            .split(';')
            .map(s=>s.trim())
            .filter(s => s.length);
        const mainDir = paths[0];
        const mainFile = resolvePath(joinPath(mainDir, "local_packages_list.json"));
        localPackagesPaths = {
            paths,
            mainDir,
            mainFile,
        };
    }
    return localPackagesPaths;
}

export function writeFileSyncIfChanged(fileName, content, encoding = "utf-8") {
    let current;
    try {
        current = readFileSync(fileName, encoding);
    } catch (e) {
        if (e.code !== "ENOENT") throw e;
    }

    if (!current || current !== content) {
        writeFileSync(fileName, content, encoding);
        return true;
    }
    return false;
};


export function getLocalPackagesList(localPackagesPaths = getLocalPackagesPathsObj()){
    if(!localPackagesList) {
        let r;
        try {
            r = JSON.parse(readFileSync(localPackagesPaths.mainFile, "utf-8"));
        } catch (e) {
            if (e.code !== "ENOENT") throw e;
        }

        if (undefined === r) r = {};
        if (undefined === r.classification) r.classification = {};
        if (undefined === r.classification.useLocalByDefault) r.classification.useLocalByDefault = true;
        if (undefined === r.classification.local) r.classification.local = [];
        if (undefined === r.classification.nonLocal) r.classification.nonLocal = [];
        if (undefined === r.classification.default) r.classification.default = [];
        if (undefined === r.packages) r.packages = {};
        localPackagesList = r;
    }
    return localPackagesList;
}

export function ymultirepoScan(localPackagesPaths = getLocalPackagesPathsObj()) {
    localPackagesList = getLocalPackagesList(localPackagesPaths);
    const deletedPackageNames = new Set(Object.keys(localPackagesList.packages));

    for (let path of localPackagesPaths.paths) {
        let files;
        try {
            files = readdirSync(path, { withFileTypes: true });
        } catch (e) {
            if(e.message.startsWith("ENOENT")) {
                console.error(`CODE00000000 Path '${path}' - does not exists.`)
                continue;
            }
            throw e;
        }
        for (let filename of files) {
            if (filename.isDirectory()) {
                let packageJsonParsed;
                const folderPath = joinPath(path, filename.name);
                try {
                    const packageJsonPath = resolvePath(joinPath(folderPath, "package.json"));
                    packageJsonParsed = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
                } catch (e) {
                    if (e.code !== "ENOENT") throw e;
                }

                if (packageJsonParsed) {
                    const { name, version } = packageJsonParsed;
                    if (!localPackagesList.packages[name]) {
                        localPackagesList.packages[name] = {};
                    }
                    const packageItem = localPackagesList.packages[name];
                    deletedPackageNames.delete(packageItem.name);

                    packageItem.name = name;
                    packageItem.version = version;
                    packageItem.path = folderPath;
                }
            }
        }

        for(let packageName of deletedPackageNames)
            delete localPackagesList.packages[packageName];
    }

    const fullPackageList = [...localPackagesList.classification.local, ...localPackagesList.classification.nonLocal, ...localPackagesList.classification.default];
    for (let packageName in localPackagesList.packages) if (!fullPackageList.includes(packageName)) localPackagesList.classification.default.push(packageName);

    localPackagesList.classification.local.sort(caseInsensitiveCompare);
    localPackagesList.classification.nonLocal.sort(caseInsensitiveCompare);
    const x = localPackagesList.classification.default.sort(caseInsensitiveCompare);

    writeFileSyncIfChanged(localPackagesPaths.mainFile, JSON.stringify(localPackagesList, undefined, "    "), "utf-8");
    console.log(`CODE00000000 Written local packages list to '${localPackagesPaths.mainFile}' successfully!`);
    return localPackagesList;
}

export function getLocalPackages(localPackagesPaths = getLocalPackagesPathsObj()) {
    if(!effectiveLocalPackages) {
        const localPackagesList = getLocalPackagesList(localPackagesPaths);
        const localPackageNames = [...new Set([...localPackagesList.classification.local, ...(localPackagesList.classification.useLocalByDefault ? localPackagesList.classification.default : [])])];
        const r = {};
        for (let packageName of localPackageNames) {
            const packageItem = localPackagesList.packages[packageName];
            if (!packageItem)
                continue;
            r[packageName] = packageItem;
        }
        effectiveLocalPackages = r;
    }
    return effectiveLocalPackages;
}

export function ymultirepoRemap(p, context, effectiveLocalPackages = getLocalPackages()) {
    if(effectiveLocalPackages && p.dependencies)
        for (let k in p.dependencies) {
            const localPackage = effectiveLocalPackages[k];
            if(localPackage) {
                // TODO Maybe package version should also be checked inside `remapLocal`.
                p.dependencies[k] = localPackage.path;
            }
        }
}