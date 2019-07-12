import * as vscode from 'vscode';
import { SRecordLine } from './srecLine';

export class SRecordDocument {
    private _srLines: SRecordLine[];
    private _statusBarItem: vscode.StatusBarItem;
    private _size: number;
    private _startAddress: number;
    private _numInvalidLines: number;

    public updateStatusBar() {
        if (!this._statusBarItem) {
            this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        }

        let editor = vscode.window.activeTextEditor;
        if (!editor) {
            this._statusBarItem.hide();
            return;
        }

        let pos = editor.selection.active;
        let doc = editor.document;

        if (doc.languageId === "s19") {
            this._updateDoc(doc);

            if (this._size < 1024) {
                this._statusBarItem.text = `$(file-binary) ${this._size} B`;
            } else {
                let showableSize = this._size / 1024;
                this._statusBarItem.text = `$(file-binary) ${showableSize} KB`;
            }

            if (this._srLines[pos.line].isData()) {
                let address = this._srLines[pos.line].charToAddress(pos.character);
                if (address >= 0) {
                    this._statusBarItem.text += ` $(mention) 0x${address.toString(16).toUpperCase()}`;
                }
            }

            this._statusBarItem.text += ` Start Address: 0x${this._startAddress.toString(16).toUpperCase()}`;

            this._statusBarItem.show();
        } else {
            this._statusBarItem.hide();
        }
    }

    public goToAddress(address: number): boolean {
        for (let i = 0; i < this._srLines.length; i++) {
            let char = this._srLines[i].addressToChar(address);
            if (char >= 0) {
                let editor = vscode.window.activeTextEditor;
                let pos = new vscode.Position(i, char);
                let sel = new vscode.Selection(pos, pos);
                editor.selection = sel;
                return true;
            }
        }

        return false;
    }

    public repair(): number {
        let workspaceEdit = new vscode.WorkspaceEdit();
        let doc = vscode.window.activeTextEditor.document;
        let edits = [];

        for (let i = 0; i < this._srLines.length; i++) {
            if (this._srLines[i].isBroken()) {
                if (this._srLines[i].repair()) {
                    let range = doc.lineAt(i).range;
                    edits.push(new vscode.TextEdit(range, this._srLines[i].toString()));
                }
            }
        }

        if (edits.length > 0) {
            workspaceEdit.set(doc.uri, edits);
            vscode.workspace.applyEdit(workspaceEdit);
        }

        return edits.length;
    }

    private _updateDoc(doc: vscode.TextDocument) {
        this._srLines = [];
        this._size = 0;
        this._startAddress = 0;
        this._numInvalidLines = 0;
        for (let i = 0; i < doc.lineCount; i++) {
            this._srLines.push(new SRecordLine(doc.lineAt(i).text));
            this._size += this._srLines[i].size();

            if (this._srLines[i].isStartAddress()) {
                this._startAddress = this._srLines[i].startAddress();
            }

            if (this._srLines[i].isInvalid()) {
                this._numInvalidLines++;
            }
        }

        if (this._numInvalidLines != 0) {
            vscode.window.showErrorMessage("Found " + this._numInvalidLines.toString() + " invalid lines.");
        }
    }

    dispose() {
        this._statusBarItem.dispose();
    }
}