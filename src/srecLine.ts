import * as vscode from 'vscode';

var TYPES = {
    HEADER: 0x00,
    DATA_16: 0x01,
    DATA_24: 0x02,
    DATA_32: 0x03,
    COUNT_16: 0x05,
    COUNT_24: 0x06,
    START_ADDRESS_32: 0x07,
    START_ADDRESS_24: 0x08,
    START_ADDRESS_16: 0x09
}

export class SRecordLine {
    startCode: string;
    rcType: number;
    byteCount: number;
    nbData: number;
    address: number;
    data: number[];
    checksum: number;

    private _correctHdr: boolean;
    private _byteSum: number;
    private _isData: boolean;
    private _isCount: boolean;
    private _isStartAddress: boolean;
    private _isEmptyLine: boolean;

    constructor(lineString: string) {
        this._correctHdr = false;
        this._byteSum = 0;
        this._isData = false;
        this._isCount = false;
        this._isStartAddress = false;
        this._isEmptyLine = lineString.length == 0;

        if (lineString.length >= 10) {
            this.startCode = lineString.charAt(0);
            this.rcType = parseInt(lineString.charAt(1));
            this.byteCount = this.parseAndUpdateChk(lineString, 0);
            if (this.rcType == TYPES.HEADER) {
                this.address = this.parseAndUpdateChk(lineString, 1) << 8;
                this.address |= this.parseAndUpdateChk(lineString, 2);
                this.nbData = this.byteCount - 3;
            } else if (this.rcType == TYPES.DATA_16) {
                this.address = this.parseAndUpdateChk(lineString, 1) << 8;
                this.address |= this.parseAndUpdateChk(lineString, 2);
                this.nbData = this.byteCount - 3;
            } else if (this.rcType == TYPES.DATA_24) {
                if (lineString.length >= 12) {
                    this.address = this.parseAndUpdateChk(lineString, 1) << 16;
                    this.address |= this.parseAndUpdateChk(lineString, 2) << 8;
                    this.address |= this.parseAndUpdateChk(lineString, 3);
                }
                this.nbData = this.byteCount - 4;
            } else if (this.rcType == TYPES.DATA_32) {
                if (lineString.length >= 14) {
                    this.address = this.parseAndUpdateChk(lineString, 1) << 24;
                    this.address |= this.parseAndUpdateChk(lineString, 2) << 16;
                    this.address |= this.parseAndUpdateChk(lineString, 3) << 8;
                    this.address |= this.parseAndUpdateChk(lineString, 4);
                }
                this.nbData = this.byteCount - 5;
            } else if (this.rcType == TYPES.COUNT_16) {
                this.address = this.parseAndUpdateChk(lineString, 1) << 8;
                this.address |= this.parseAndUpdateChk(lineString, 2);
                this.nbData = 0;
            } else if (this.rcType == TYPES.COUNT_24) {
                if (lineString.length >= 12) {
                    this.address = this.parseAndUpdateChk(lineString, 1) << 16;
                    this.address |= this.parseAndUpdateChk(lineString, 2) << 8;
                    this.address |= this.parseAndUpdateChk(lineString, 3);
                }
                this.nbData = 0;
            } else if (this.rcType == TYPES.START_ADDRESS_32) {
                if (lineString.length >= 14) {
                    this.address = this.parseAndUpdateChk(lineString, 1) << 24;
                    this.address |= this.parseAndUpdateChk(lineString, 2) << 16;
                    this.address |= this.parseAndUpdateChk(lineString, 3) << 8;
                    this.address |= this.parseAndUpdateChk(lineString, 4);
                }
                this.nbData = 0;
            } else if (this.rcType == TYPES.START_ADDRESS_24) {
                if (lineString.length >= 12) {
                    this.address = this.parseAndUpdateChk(lineString, 1) << 16;
                    this.address |= this.parseAndUpdateChk(lineString, 2) << 8;
                    this.address |= this.parseAndUpdateChk(lineString, 3);
                }
                this.nbData = 0;
            } else if (this.rcType == TYPES.START_ADDRESS_16) {
                this.address = this.parseAndUpdateChk(lineString, 1) << 8;
                this.address |= this.parseAndUpdateChk(lineString, 2);
                this.nbData = 0;
            }
            this.address = this.address >>> 0;

            this._isData = this.rcType === TYPES.DATA_16 ||
                this.rcType === TYPES.DATA_24 ||
                this.rcType === TYPES.DATA_32;
            this._isCount = this.rcType === TYPES.COUNT_16 || this.rcType === TYPES.COUNT_24;
            this._isStartAddress = this.rcType === TYPES.START_ADDRESS_16 ||
                this.rcType === TYPES.START_ADDRESS_24 ||
                this.rcType === TYPES.START_ADDRESS_32;
        }

        this._correctHdr = (this.startCode === 'S' &&
            this.rcType != NaN &&
            this.nbData != NaN &&
            this.address != NaN);

        this.data = [];
        let offset = 0;
        if (this.rcType == TYPES.HEADER) {
            offset = 3;
        } else if (this.rcType == TYPES.DATA_16 ||
            this.rcType == TYPES.COUNT_16 ||
            this.rcType == TYPES.START_ADDRESS_16) {
            offset = 3;
        } else if (this.rcType == TYPES.DATA_24 ||
            this.rcType == TYPES.COUNT_24 ||
            this.rcType == TYPES.START_ADDRESS_24) {
            offset = 4;
        } else if (this.rcType == TYPES.DATA_32 ||
            this.rcType == TYPES.START_ADDRESS_32) {
            offset = 5;
        }
        if (this._correctHdr) {
            let nbBytes = Math.trunc((lineString.length - (offset + 1) * 2) / 2);
            let nb = Math.min(nbBytes, this.nbData);
            for (let i = 0; i < nb; i++) {
                this.data.push(this.parseAndUpdateChk(lineString, offset + i));
            }
        }

        if (this._correctHdr && (lineString.length >= ((offset + 1) * 2 + 2 * this.nbData + 2))) {
            this.checksum = parseInt(lineString.substr((offset + 1) * 2 + 2 * this.nbData, 2), 16);
        }
    }

    private parseAndUpdateChk(lineString: string, byteId: number) {
        let res = parseInt(lineString.substr(2 + 2 * byteId, 2), 16);
        this._byteSum += res;
        return res;
    }

    public isHeader(): boolean {
        return this._correctHdr && this.rcType === TYPES.HEADER;
    }

    public isData(): boolean {
        return this._correctHdr && this._isData;
    }

    public isCount(): boolean {
        return this._correctHdr && this._isCount;
    }

    public isStartAddress(): boolean {
        return this._correctHdr && this._isStartAddress;
    }

    public size(): number {
        if (this.isData()) {
            return this.nbData;
        }

        return 0;
    }

    public startAddress(): number {
        if (this.isStartAddress()) {
            return this.address;
        }

        return 0;
    }

    public charToAddress(character: number): number {
        if (this.isData()) {
            let offset = 0;
            if (this.rcType == TYPES.DATA_16) {
                offset = 8;
            } else if (this.rcType == TYPES.DATA_24) {
                offset = 10;
            } else if (this.rcType == TYPES.DATA_32) {
                offset = 12;
            }
            let relative = (character - offset) / 2;
            if (relative >= 0) {
                relative = Math.trunc(relative)
                if (relative < this.nbData) {
                    return relative + this.address;
                }
            }
        }

        return -1;
    }

    public addressToChar(address: number): number {
        if (this.isData()) {
            let offset = 0;
            if (this.rcType == TYPES.DATA_16) {
                offset = 8;
            } else if (this.rcType == TYPES.DATA_24) {
                offset = 10;
            } else if (this.rcType == TYPES.DATA_32) {
                offset = 12;
            }

            let lowRange = this.address;
            let highRange = lowRange + this.nbData - 1;
            if (lowRange <= address && address <= highRange) {
                return ((address - lowRange) * 2) + offset;
            }
        }
        return -1;
    }

    private calcChecksum(): number {
        return (255 - (this._byteSum & 0xFF)) & 0xFF;
    }

    public isInvalid(): boolean {
        return !this._isEmptyLine && !this._correctHdr;
    }

    public isBroken(): boolean {
        if (this._correctHdr && (this.nbData == this.data.length)) {
            return this.calcChecksum() != this.checksum;
        }
        return true;
    }

    public repair(): boolean {
        if (this._correctHdr) {
            if (this.data.length < this.nbData) {
                let toAdd = (this.nbData - this.data.length);
                for (let i = 0; i < toAdd; i++) {
                    this.data.push(0);
                }
            } else if (this.data.length > this.nbData) {
                this.data = this.data.slice(0, this.nbData - 1);
            }

            this.checksum = this.calcChecksum();
            return true;
        }

        return false;
    }

    private appendByte(str: string, byte: number): string {
        return str.concat(("00" + byte.toString(16)).substr(-2));
    }

    public toString(): string {
        let res = 'S';
        res = res.concat(this.rcType.toString());
        res = this.appendByte(res, this.byteCount);

        if (this.rcType == TYPES.HEADER || this.rcType == TYPES.DATA_16 ||
            this.rcType == TYPES.COUNT_16 || this.rcType == TYPES.START_ADDRESS_16) {
            res = this.appendByte(res, (this.address >> 8) & 0xFF);
            res = this.appendByte(res, this.address & 0xFF);
        } else if (this.rcType == TYPES.DATA_24 || this.rcType == TYPES.COUNT_24 ||
            this.rcType == TYPES.START_ADDRESS_24) {
            res = this.appendByte(res, (this.address >> 16) & 0xFF);
            res = this.appendByte(res, (this.address >> 8) & 0xFF);
            res = this.appendByte(res, this.address & 0xFF);
        } else if (this.rcType == TYPES.DATA_32 || this.rcType == TYPES.START_ADDRESS_32) {
            res = this.appendByte(res, (this.address >> 24) & 0xFF);
            res = this.appendByte(res, (this.address >> 16) & 0xFF);
            res = this.appendByte(res, (this.address >> 8) & 0xFF);
            res = this.appendByte(res, this.address & 0xFF);
        }

        for (let i = 0; i < this.data.length; i++) {
            res = this.appendByte(res, this.data[i]);
        }

        res = this.appendByte(res, this.checksum);
        return res.toUpperCase();
    }
}