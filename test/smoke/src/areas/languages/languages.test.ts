/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Application, ProblemSeverity, Problems, Logger } from '../../../../automation';
import { installAllHandlers } from '../../utils';

export function setup(logger: Logger) {
	describe('Language Features', () => {

		// Shared before/after handling
		installAllHandlers(logger);

		it('verifies quick outline', async function () {
			const app = this.app as Application;
			await app.workbench.quickaccess.openFile('style.css');

			await app.workbench.quickaccess.openQuickOutline();
			await app.workbench.quickinput.waitForQuickInputElements(names => names.length === 2);
		});

		it('verifies problems view', async function () {
			const app = this.app as Application;
			await app.workbench.quickaccess.openFile('style.css');
			await app.workbench.editor.waitForTypeInEditor('style.css', '.foo{}');

			await app.code.waitForElement(Problems.getSelectorInEditor(ProblemSeverity.WARNING));

			await app.workbench.problems.showProblemsView();
			await app.code.waitForElement(Problems.getSelectorInProblemsView(ProblemSeverity.WARNING));
			await app.workbench.problems.hideProblemsView();
		});

		it('verifies settings', async function () {
			const app = this.app as Application;
			await app.workbench.settingsEditor.addUserSetting('css.lint.emptyRules', '"error"');
			await app.workbench.quickaccess.openFile('style.css');

			await app.code.waitForElement(Problems.getSelectorInEditor(ProblemSeverity.ERROR));

			await app.workbench.problems.showProblemsView();
			await app.code.waitForElement(Problems.getSelectorInProblemsView(ProblemSeverity.ERROR));
			await app.workbench.problems.hideProblemsView();
		});
	});
}
