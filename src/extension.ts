import * as vscode from 'vscode';
import { window, workspace, commands, Disposable, ExtensionContext } from 'vscode';
import { SRecordDocument } from './srecDoc'

export function activate(context: vscode.ExtensionContext) {
    let srecDoc = new SRecordDocument();
    let controller = new SRecordDocumentController(srecDoc);

    var findDisposable = commands.registerCommand('SRecord.Find', () => {
        if (window.activeTextEditor.document.languageId != "s19") {
            window.showErrorMessage("This command is only available with \".s19\" files.");
            return;
        }

        window.showInputBox({ prompt: 'Type an address to find (start with 0x)' }).then(val => {
            let address = parseInt(val);
            if (address === NaN || address < 0) {
                window.showErrorMessage("Wrong address format.");
                return;
            }

            if (!srecDoc.goToAddress(address)) {
                window.showWarningMessage("The address 0x" + address.toString(16) + " was not found.")
            }
        });
    });

    var repairDisposable = commands.registerCommand('SRecord.Repair', () => {
        if(window.activeTextEditor.document.languageId != "s19")
        {
            window.showErrorMessage("This command is only available with \".hex\" files.");
            return;
        }

        let nbRep = srecDoc.repair();
        if(nbRep > 0) {
            window.showInformationMessage((nbRep === 1) ? "1 record has been repaired." : nbRep + " records have been repaired");
        } else {
            window.showInformationMessage("Nothing has been done.");
        }
    });

    context.subscriptions.push(srecDoc);
    context.subscriptions.push(controller);
    context.subscriptions.push(findDisposable);
    context.subscriptions.push(repairDisposable);
}

export function deactivate() {
}


class SRecordDocumentController {
    private _srecDoc: SRecordDocument;
    private _disposable: Disposable;

    constructor(srecDoc: SRecordDocument) {
        this._srecDoc = srecDoc;
        this._srecDoc.updateStatusBar();

        let subscriptions: Disposable[] = [];
        window.onDidChangeActiveTextEditor(this._onEdit, this, subscriptions);
        window.onDidChangeTextEditorSelection(this._onEdit, this, subscriptions);
        workspace.onDidSaveTextDocument(this._onSave, this, subscriptions);

        this._disposable = Disposable.from(...subscriptions);
    }

    dispose() {
        this._disposable.dispose();
    }

    private _onEdit() {
        this._srecDoc.updateStatusBar();
    }

    private _onSave() {
        if (window.activeTextEditor.document.languageId === "s19" &&
            workspace.getConfiguration("srecord").get("repairOnSave", false)) {
            if (this._srecDoc.repair() > 0) {
                window.activeTextEditor.document.save();
            }
        }
    }
}