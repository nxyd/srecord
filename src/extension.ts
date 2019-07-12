import * as vscode from 'vscode';
import { SRecordDocument } from './srecDoc'

export function activate(context: vscode.ExtensionContext) {
    let srecDoc = new SRecordDocument();
    let controller = new SRecordDocumentController(srecDoc);

    var findDisposable = vscode.commands.registerCommand('SRecord.Find', () => {
        if (vscode.window.activeTextEditor.document.languageId != "s19") {
            vscode.window.showErrorMessage("This command is only available with \".s19\" files.");
            return;
        }

        vscode.window.showInputBox({ prompt: 'Type an address to find (start with 0x)' }).then(val => {
            let address = parseInt(val);
            if (address === NaN || address < 0) {
                vscode.window.showErrorMessage("Wrong address format.");
                return;
            }

            if (!srecDoc.goToAddress(address)) {
                vscode.window.showWarningMessage("The address 0x" + address.toString(16) + " was not found.")
            }
        });
    });

    var repairDisposable = vscode.commands.registerCommand('SRecord.Repair', () => {
        if(vscode.window.activeTextEditor.document.languageId != "s19")
        {
            vscode.window.showErrorMessage("This command is only available with \".hex\" files.");
            return;
        }

        let nbRep = srecDoc.repair();
        if(nbRep > 0) {
            vscode.window.showInformationMessage((nbRep === 1) ? "1 record has been repaired." : nbRep + " records have been repaired");
        } else {
            vscode.window.showInformationMessage("Nothing has been done.");
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
    private _disposable: vscode.Disposable;

    constructor(srecDoc: SRecordDocument) {
        this._srecDoc = srecDoc;
        this._srecDoc.updateStatusBar();

        let subscriptions: vscode.Disposable[] = [];
        vscode.window.onDidChangeActiveTextEditor(this._onEdit, this, subscriptions);
        vscode.window.onDidChangeTextEditorSelection(this._onEdit, this, subscriptions);
        vscode.workspace.onDidSaveTextDocument(this._onSave, this, subscriptions);

        this._disposable = vscode.Disposable.from(...subscriptions);
    }

    dispose() {
        this._disposable.dispose();
    }

    private _onEdit() {
        this._srecDoc.updateStatusBar();
    }

    private _onSave() {
        if (vscode.window.activeTextEditor.document.languageId === "s19" &&
            vscode.workspace.getConfiguration("srecord").get("repairOnSave", false)) {
            if (this._srecDoc.repair() > 0) {
                vscode.window.activeTextEditor.document.save();
            }
        }
    }
}