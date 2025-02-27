/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Application, ApplicationOptions, Logger, Quality } from '../../../../automation';
import { getRandomUserDataDir, startApp, timeout, installDiagnosticsHandler, installAppAfterHandler } from '../../utils';

export function setup(ensureStableCode: () => string | undefined, logger: Logger) {
	describe('Data Loss (insiders -> insiders)', () => {

		let app: Application | undefined = undefined;

		// Shared before/after handling
		installDiagnosticsHandler(logger, () => app);
		installAppAfterHandler(() => app);

		it('verifies opened editors are restored', async function () {
			app = await startApp(this.defaultOptions);

			// Open 3 editors and pin 2 of them
			await app.workbench.quickaccess.openFile('www');
			await app.workbench.quickaccess.runCommand('View: Keep Editor');

			await app.workbench.quickaccess.openFile('app.js');
			await app.workbench.quickaccess.runCommand('View: Keep Editor');

			await app.workbench.editors.newUntitledFile();

			await app.restart();

			// Verify 3 editors are open
			await app.workbench.editors.selectTab('Untitled-1');
			await app.workbench.editors.selectTab('app.js');
			await app.workbench.editors.selectTab('www');

			await app.stop();
			app = undefined;
		});

		it('verifies that "hot exit" works for dirty files (without delay)', function () {
			return testHotExit.call(this, undefined);
		});

		it('verifies that "hot exit" works for dirty files (with delay)', function () {
			return testHotExit.call(this, 2000);
		});

		it('verifies that auto save triggers on shutdown', function () {
			return testHotExit.call(this, undefined, true);
		});

		async function testHotExit(restartDelay: number | undefined, autoSave: boolean | undefined) {
			app = await startApp(this.defaultOptions);

			if (autoSave) {
				await app.workbench.settingsEditor.addUserSetting('files.autoSave', '"afterDelay"');
			}

			await app.workbench.editors.newUntitledFile();

			const untitled = 'Untitled-1';
			const textToTypeInUntitled = 'Hello from Untitled';
			await app.workbench.editor.waitForTypeInEditor(untitled, textToTypeInUntitled);
			await app.workbench.editors.waitForTab(untitled, true);

			const readmeMd = 'readme.md';
			const textToType = 'Hello, Code';
			await app.workbench.quickaccess.openFile(readmeMd);
			await app.workbench.editor.waitForTypeInEditor(readmeMd, textToType);
			await app.workbench.editors.waitForTab(readmeMd, !autoSave);

			if (typeof restartDelay === 'number') {
				// this is an OK use of a timeout in a smoke test
				// we want to simulate a user having typed into
				// the editor and pausing for a moment before
				// terminating
				await timeout(restartDelay);
			}

			await app.restart();

			await app.workbench.editors.waitForTab(readmeMd, !autoSave);
			await app.workbench.quickaccess.openFile(readmeMd);
			await app.workbench.editor.waitForEditorContents(readmeMd, contents => contents.indexOf(textToType) > -1);

			await app.workbench.editors.waitForTab(untitled, true);
			await app.workbench.quickaccess.openFile(untitled, textToTypeInUntitled);
			await app.workbench.editor.waitForEditorContents(untitled, contents => contents.indexOf(textToTypeInUntitled) > -1);

			await app.stop();
			app = undefined;
		}
	});

	describe('Data Loss (stable -> insiders)', () => {

		let insidersApp: Application | undefined = undefined;
		let stableApp: Application | undefined = undefined;

		// Shared before/after handling
		installDiagnosticsHandler(logger, () => insidersApp ?? stableApp);
		installAppAfterHandler(() => insidersApp ?? stableApp, async () => stableApp?.stop());

		it('verifies opened editors are restored', async function () {
			const stableCodePath = ensureStableCode();
			if (!stableCodePath) {
				this.skip();
			}

			// On macOS, the stable app fails to launch on first try,
			// so let's retry this once
			// https://github.com/microsoft/vscode/pull/127799
			if (process.platform === 'darwin') {
				this.retries(2);
			}

			const userDataDir = getRandomUserDataDir(this.defaultOptions);

			const stableOptions: ApplicationOptions = Object.assign({}, this.defaultOptions);
			stableOptions.codePath = stableCodePath;
			stableOptions.userDataDir = userDataDir;
			stableOptions.quality = Quality.Stable;

			stableApp = new Application(stableOptions);
			await stableApp.start();

			// Open 3 editors and pin 2 of them
			await stableApp.workbench.quickaccess.openFile('www');
			await stableApp.workbench.quickaccess.runCommand('View: Keep Editor');

			await stableApp.workbench.quickaccess.openFile('app.js');
			await stableApp.workbench.quickaccess.runCommand('View: Keep Editor');

			await stableApp.workbench.editors.newUntitledFile();

			await stableApp.stop();
			stableApp = undefined;

			const insiderOptions: ApplicationOptions = Object.assign({}, this.defaultOptions);
			insiderOptions.userDataDir = userDataDir;

			insidersApp = new Application(insiderOptions);
			await insidersApp.start();

			// Verify 3 editors are open
			await insidersApp.workbench.editors.selectTab('Untitled-1');
			await insidersApp.workbench.editors.selectTab('app.js');
			await insidersApp.workbench.editors.selectTab('www');

			await insidersApp.stop();
			insidersApp = undefined;
		});

		it.skip('verifies that "hot exit" works for dirty files (without delay)', async function () { // TODO@bpasero enable test once 1.64 shipped
			return testHotExit.call(this, undefined);
		});

		it('verifies that "hot exit" works for dirty files (with delay)', async function () {
			return testHotExit.call(this, 2000);
		});

		async function testHotExit(restartDelay: number | undefined) {
			const stableCodePath = ensureStableCode();
			if (!stableCodePath) {
				this.skip();
			}

			const userDataDir = getRandomUserDataDir(this.defaultOptions);

			const stableOptions: ApplicationOptions = Object.assign({}, this.defaultOptions);
			stableOptions.codePath = stableCodePath;
			stableOptions.userDataDir = userDataDir;
			stableOptions.quality = Quality.Stable;

			stableApp = new Application(stableOptions);
			await stableApp.start();

			await stableApp.workbench.editors.newUntitledFile();

			const untitled = 'Untitled-1';
			const textToTypeInUntitled = 'Hello from Untitled';
			await stableApp.workbench.editor.waitForTypeInEditor(untitled, textToTypeInUntitled);
			await stableApp.workbench.editors.waitForTab(untitled, true);

			const readmeMd = 'readme.md';
			const textToType = 'Hello, Code';
			await stableApp.workbench.quickaccess.openFile(readmeMd);
			await stableApp.workbench.editor.waitForTypeInEditor(readmeMd, textToType);
			await stableApp.workbench.editors.waitForTab(readmeMd, true);

			if (typeof restartDelay === 'number') {
				// this is an OK use of a timeout in a smoke test
				// we want to simulate a user having typed into
				// the editor and pausing for a moment before
				// terminating
				await timeout(restartDelay);
			}

			await stableApp.stop();
			stableApp = undefined;

			const insiderOptions: ApplicationOptions = Object.assign({}, this.defaultOptions);
			insiderOptions.userDataDir = userDataDir;

			insidersApp = new Application(insiderOptions);
			await insidersApp.start();

			await insidersApp.workbench.editors.waitForTab(readmeMd, true);
			await insidersApp.workbench.quickaccess.openFile(readmeMd);
			await insidersApp.workbench.editor.waitForEditorContents(readmeMd, contents => contents.indexOf(textToType) > -1);

			await insidersApp.workbench.editors.waitForTab(untitled, true);
			await insidersApp.workbench.quickaccess.openFile(untitled, textToTypeInUntitled);
			await insidersApp.workbench.editor.waitForEditorContents(untitled, contents => contents.indexOf(textToTypeInUntitled) > -1);

			await insidersApp.stop();
			insidersApp = undefined;
		}
	});
}
