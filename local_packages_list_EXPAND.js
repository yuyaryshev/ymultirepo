
let policyCompareCalled = false;

const POLICY_CMP_ROOT = resolve(TEMP_DIR, "policy");
const POLICY_CMP_ETALON = resolve(POLICY_CMP_ROOT, "etalon");
const POLICY_CMP_ACTUAL = resolve(POLICY_CMP_ROOT, "actual");

function makePolicyCompareDirs() {
	if(!policyCompareCalled) {
		mkdirSync(POLICY_CMP_ROOT);
		mkdirSync(POLICY_CMP_ETALON);
		mkdirSync(POLICY_CMP_ACTUAL);
		policyCompareCalled = true;
	}
}

const POLICY_SPLITTER = "SYNC_APPEND";
class Policy {
	// this.policy = {
	// 	"files": {
	// 		"filename" : "notify" | "allow" | "delete" | "sync" | "syncJson",
	// 	}
	// }

	constructor(policyProjectPath) {
		this.policyProjectPath = policyProjectPath;
	}

	etalonPath(name) {
		return resolve(this.policyProjectPath, name);
	}

	readEtalon(name) {
		return readFileSync(this.etalonPath(name), "utf-8");
	}

	readEtalonJson(name) {
		return JSON.parse(this.readEtalon(name));
	}

	read() {
		this.policyPackage = this.readEtalonJson("package.json");
		this.name = policyPackage.name;
		
		try {
			this.policy = this.readEtalonJson("policy.json");
		} catch(e) {
			if (e.code !== "ENOENT") throw e;
		}
		
		if(undefined === this.policy) this.policy = {};
		if(undefined === this.policy.files) this.policy.files = {};
	}
	
	write() {
		checkedWriteFileSync(this.etalonPath("policy.json"), JSON.stringify(this.policy, undefined, "    "), "utf-8");
	}
	
	apply(targetProjectPath, updatingPolicyMode){
		if(undefined === this.policy)
			throw new Error(`CODE00000000 ERROR in Policy.apply: this.policy is undefined. Call .read() first!`);

		let packageJson
		try {
			packageJson = JSON.parse(readFileSync(resolve(targetProjectPath, "package.json"), "utf-8"));
		} catch (e) {
			console.error(`ERROR CODE00000000 Couldn't apply policy ${this.name} to project '${targetProjectPath}' because of error '${e.message}' when reading package.json `);
			return;
		}

		if(!packageJson || !packageJson.name || packageJson.name === "undefined") {
			console.error(`ERROR CODE00000000 Couldn't apply policy ${this.name} to project '${targetProjectPath}' because package.json have no valid 'name'`);
			return;
		}

		let files;
		try {
			files = readdirSync(targetProjectPath, { withFileTypes: true });
		} catch (e) {
			if (e.message.startsWith("ENOENT")) {
				console.error(`CODE00000000 ERROR in Policy.apply: path '${targetProjectPath}' - does not exists.`);
				continue;
			}
			throw e;
		}

		for (let filename of files) {
			if (!filename.isDirectory()) {
				const filename = filename.name;
				const targetFullPath = resolve(targetProjectPath, filename.name);
				
				let filePolicy = this.policy.files[filename];
				if(undefined === filePolicy) {
					filePolicy = this.policy.files[filename] = "notify";
					
				}
				
				switch(filePolicy) {
					case "notify":
						console.log(`POLICY NOTIFICATION: ${targetFullPath} - add this file to the policy or remove it.`);
						break;
					default:
						console.warn(`POLICY WARNING: ${targetFullPath} - unknown policy mode '${filePolicy}'`);
						break;
					case "allowed": 
						break;
					case "delete":
						try {
							unlinkSync(targetFullPath);
							console.log(`POLICY DELETION: ${targetFullPath} - was deleted because of policy setting.`);
						} catch(e) {
							console.error(`POLICY DELETION: ${targetFullPath} - FAILED because of error: ${e.message}.`);
						}
						break;
					case "sync":
						this.syncFile(packageJson, filename, targetFullPath, overwrite, updatingPolicyMode);
						break;
					case "syncJson":
						this.syncJsonFile(packageJson, filename, targetFullPath, overwrite, updatingPolicyMode);
						break;
				}

			}
		}

		function syncFile(packageJson, filename, targetFullPath, overwrite, updatingPolicyMode) {
			const etalonStr = fileReadSync(this.etalonPath(filename), "utf-8");
			const etalonSplitted = etalonStr.split(POLICY_SPLITTER)[0];
			const haveSplitter = etalonStr !== etalonSplitted;
			const etalonRestored = (haveSplitter ? etalonSplitted + POLICY_SPLITTER : etalonStr)

			let contentStr;
			try {
				contentStr = fileReadSync(targetFullPath, "utf-8");
			} catch (e) {
				if (e.code !== "ENOENT") throw e;
			}

			let contentSplitted;
			if(contentStr) {
				let contentSplitted = contentStr.split(POLICY_SPLITTER)[0];
				if(contentSplitted === etalonSplitted)
					return; // Equal - no actions needed
			}

			const newContent = (haveSplitter ? etalonRestored + (contentSplitted[1]||"") : etalonStr);
			if(!contentStr || overwrite) {
				checkedWriteFileSync(targetFullPath, newContent, "TEST", "utf-8");
			} else {
				makePolicyCompareDirs();

				const etalonCmpFileName = resolve(POLICY_CMP_ETALON, packageJson.name + "-" + filename);
				const actualCmpFileName = resolve(POLICY_CMP_ACTUAL, packageJson.name + "-" + filename);

				checkedWriteFileSync(etalonCmpFileName, newContent);
				linkSync(targetFullPath, actualCmpFileName);

				// HINT - DELETE LATER
				//		Про hardlink:
				//			- https://stackoverflow.com/questions/26695726/what-is-the-difference-between-fs-link-and-fs-symlink-are-they-platform-indepen
				//			- https://github.com/nodejs/node-v0.x-archive/issues/2274
				//			- https://tyapk.ru/blog/post/hardlink-and-symlink-windows
			}
		}

		function syncJsonFile(packageJson, filename, targetFullPath, overwrite, updatingPolicyMode) {
			const etalonObj = JSON.parse(fileReadSync(this.etalonPath(filename), "utf-8"));
			let shouldSaveEtalon = false;

			if(!etalonObj["!notify"]) { etalonObj["!notify"] = []; shouldSaveEtalon = true; }
			if(!etalonObj["!ignore"]) { etalonObj["!ignore"] = []; shouldSaveEtalon = true; }
			if(!etalonObj["!delete"]) { etalonObj["!delete"] = []; shouldSaveEtalon = true; }
			if(!etalonObj["!sync"]) { etalonObj["!sync"] = []; shouldSaveEtalon = true; }

			let contentStr;
			let contentObj;
			try {
				contentStr = fileReadSync(targetFullPath, "utf-8");
				contentObj = JSON.parse(contentStr);
			} catch (e) {
				if (e.code !== "ENOENT") throw e;
			}

			const newContentObj = { ...contentObj};

			const keys = {
				notify: new Set(etalonObj["!notify"]);
				ignore: new Set(etalonObj["!ignore"]);
				delete: new Set(etalonObj["!delete"]);
				sync: new Set(etalonObj["!sync"]);
			};

			for(let k in newContentObj) {
				if(keys.ignore.has(k)) {
					// ignore them
				} else if(keys.delete.has(k)) {
					delete contentObj[k];
				} else if(keys.sync.has(k)) {
					contentObj[k] = etalonObj[k];
				} else {
					if(keys.notify.has(k))
						console.log(`POLICY NOTIFICATION: ${targetFullPath} . ${k} - add this key to the policy or remove it.`);
					else {
						keys.notify.add(k);
						if(!etalonObj["!notify"]) etalonObj["!notify"] = [];
						etalonObj["!notify"].push(k);
						shouldSaveEtalon = true;
					}
				}
			}

			if(shouldSaveEtalon)
				checkedWriteFileSync(this.etalonPath(filename), JSON.stringify(etalonObj,undefined, "    "), "TEST", "utf-8");

			const newContentStr = JSON.stringify(newContentObj, undefined, "    ");

			if(!contentStr || overwrite) {
				checkedWriteFileSync(targetFullPath, newContentStr, "TEST", "utf-8");
			} else {
				makePolicyCompareDirs();
				const etalonCmpFileName = resolve(POLICY_CMP_ETALON, packageJson.name + "-" + filename);
				const actualCmpFileName = resolve(POLICY_CMP_ACTUAL, packageJson.name + "-" + filename);

				checkedWriteFileSync(etalonCmpFileName, newContentStr);
				linkSync(targetFullPath, actualCmpFileName);
			}
		}
	}
}

function ymultirepoApplyPolicies() {
	for(let policyName in localPackagesList.policies) {
		const policyProjectNames = localPackagesList.policies[policyName];
		const policyPackage = localPackagesList.packages[policyName];
		if(!policyPackage || !policyPackage.path) {
			console.warn(`CODE00000000 ERROR Policy folder '${policyName}' - not found`);
		}

		const policy = new Policy(policyPackage.path);
		policy.read();
		for(let updatingPolicyMode=1; updatingPolicyMode>=0; updatingPolicyMode--) {
			for(let projectName of policyProjectNames) {
				const project = localPackagesList.packages[projectName];
				if(!project) continue;
				policy.apply(project.path, !!updatingPolicyMode);
			}
			policy.write();
		}
	}

	if(policyCompareCalled)
		execSync(`meld ${POLICY_CMP_ETALON} ${POLICY_CMP_ACTUAL}`, {stdio: 'inherit'});
}
