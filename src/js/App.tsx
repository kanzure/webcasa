/** App logic and state **/

import React from "react";
import CryptoJS from 'crypto-js'
import { WebcashWallet, SecretWebcash } from "webcash";

import { shorten } from "./_util";
import { ActionResult } from "./Common";
import { Header } from "./Header";
import { Navigation } from "./Navigation";
import { ViewCheck } from "./ViewCheck";
import { ViewExternalReceive } from "./ViewExternalReceive";
import { ViewHistory } from "./ViewHistory";
import { ViewPassword } from "./ViewPassword";
import { ViewRecover } from "./ViewRecover";
import { ViewSecrets } from "./ViewSecrets";
import { ViewSettings } from "./ViewSettings";
import { ViewTerms } from "./ViewTerms";
import { ViewTransfers } from "./ViewTransfers";
import { ViewUnlock } from "./ViewUnlock";

/**
 * Optionally encrypted with a password.
 * When no password is provided, this class works like WebcashWalletLocalStorage.
 */
export class CasaWallet extends WebcashWallet {
    private static locStoKey = 'wallet';
    private password;

    private constructor(walletData: Partial<WebcashWalletData> = {}, password?: string) {
        super(walletData);
        this.password = password;
    }

    public static create(walletdata: Partial<WebcashWalletData> = {}, password?: string): WebcashWallet {
        const passHash = password ? CasaWallet.makePassword(password) : null;
        const wallet = new CasaWallet(walletdata, passHash);
        return wallet;
    }

    public static exists(): bool {
        return null !== window.localStorage.getItem(CasaWallet.locStoKey);
    }

    private static makePassword(password: string): string {
        const salted_pass = password + '_webcasa_salt_rdJpbXdL2YrPHymp';
        return CryptoJS.SHA256(salted_pass).toString();
    }

    public setPassword(password: string) {
        this.password = CasaWallet.makePassword(password);
    }

    public save(): boolean {
        const contents = this.getContents();
        const json = JSON.stringify(contents, null, 4);
        const encrypted = this.password ? CryptoJS.AES.encrypt(json, this.password) : json;
        window.localStorage.setItem(CasaWallet.locStoKey, encrypted.toString());
        console.debug("(webcasa) Wallet saved to localStorage");
        return true;
    }

    public static load(password?: string): WebcashWallet | undefined {
        const rawWallet = window.localStorage.getItem(CasaWallet.locStoKey);
        if (!rawWallet) {
            console.warn("(webcasa) Wallet not found in localStorage");
            return;
        }

        let wallet;
        if (!password) {
            wallet = new CasaWallet(JSON.parse(rawWallet));
        } else {
            try {
                const passHash = CasaWallet.makePassword(password);
                const strWallet = CryptoJS.AES.decrypt(rawWallet, passHash).toString(CryptoJS.enc.Utf8);
                wallet = new CasaWallet(JSON.parse(strWallet), passHash);
            } catch(err) {
                console.warn("(webcasa) Incorrect password when loading wallet");
                return;
            }
        }
        console.log("(webcasa) Wallet loaded from localStorage");
        return wallet;
    }

}

export class App extends React.Component {

    constructor(props) {
        super(props);

        /* User actions */

        this.onAcceptTerms = this.onAcceptTerms.bind(this);
        this.onChangeView = this.onChangeView.bind(this);
        this.onCreateWallet = this.onCreateWallet.bind(this);
        this.onUploadWallet = this.onUploadWallet.bind(this);
        this.onDownloadWallet = this.onDownloadWallet.bind(this);
        this.onCheckWallet = this.onCheckWallet.bind(this);
        this.onRecoverWallet = this.onRecoverWallet.bind(this);
        this.onReceiveWebcash = this.onReceiveWebcash.bind(this);
        this.onSendAmount = this.onSendAmount.bind(this);
        this.onSetPassword = this.onSetPassword.bind(this);
        this.onUnlockWallet = this.onUnlockWallet.bind(this);

        /* State initialization */

        let wallet;
        const conf = this.loadConfig();
        if (!CasaWallet.exists()) {
            // Create and save a new wallet
            wallet = CasaWallet.create();
            wallet.setLegalAgreementsToTrue(); // wallet-level accept
            wallet.save();
        } else {
            wallet = conf.encrypted ? null : CasaWallet.load();
        }
        if (wallet && !wallet.checkLegalAgreements()) {
            // Handle corner cases like old/corrupted wallets
            wallet.setLegalAgreementsToTrue(); // wallet-level accept
            wallet.save();
        }
        this.state = {
            wallet: wallet,
            // Ephemeral app state
            view: 'Transfers',
            inProgress: false,
            lastReceive: '',
            lastSend: null,
            lastCheck: [],
            lastRecover: [],
            externalAction: null,
            // Persistent app config
            downloaded: conf.downloaded ?? true,
            encrypted: conf.encrypted ?? false,
            termsAccepted: conf.termsAccepted ?? false, // site-level accept
        };

        /* On 1st visit - process URL parameters */

        const params = new URLSearchParams(window.location.search);
        const webcash_raw = params.get('receive');
        if (webcash_raw) {
            try {
                const webcash = SecretWebcash.deserialize(webcash_raw)
                const memo = params.get('memo') ?? '';
                this.state.externalAction = ['receive', {webcash: webcash, memo: memo}];
            } catch (err) {
                console.error(err);
            }
        }

        /* On page exit - alert about unsaved changes */

        const dis = this;
        window.addEventListener("beforeunload", function(e) {
            if (dis.state.wallet && dis.state.inProgress) {
                e.preventDefault();
                e.returnValue = "Are you sure?";
                return "Are you sure?";
            }
        });
    }

    /* Helper methods */

    private loadConfig() {
        // If 'casa' in localStorage, rename to 'config' // TODO: delete this (May 7)
        const dataLegacy = window.localStorage.getItem('casa');
        if (dataLegacy) {
            window.localStorage.setItem('config', dataLegacy);
            window.localStorage.removeItem('casa');
        }

        const data = window.localStorage.getItem('config');
        if (data) {
            return JSON.parse(data);
        } else {
            return {};
        }
    }

    private saveConfig() {
        console.debug("(webcasa) saving config")
        const state = {
            downloaded: this.state.downloaded,
            encrypted: this.state.encrypted,
            termsAccepted: this.state.termsAccepted,
        };
        window.localStorage.setItem('config', JSON.stringify(state, null, 4));

    }

    private replaceWallet(wallet: WebcashWallet): bool {
        this.setState({
            wallet: wallet,
            downloaded: true,
            encrypted: false,
            inProgress: false,
            lastReceive: '',
            lastSend: null,
        }, this.saveConfig);
    }

    private saveModifiedWallet(alreadySaved=false) {
        if (!alreadySaved) {
            this.state.wallet.save();
        }
        this.setState({
            wallet: this.state.wallet, // force repaint
            downloaded: false,
        }, this.saveConfig);
    }

    /* Handle navigation */

    onAcceptTerms() {
        this.setState({termsAccepted: true}, this.saveConfig);
    }

    onChangeView(view) {
        if (this.state.inProgress) {
            alert("Please wait for the process to complete");
        } else {
            this.setState({view: view});
        }
    }

    /* Handle Settings (wallet operations) */

    private confirmOverwriteWallet(): bool {
        const balance = this.state.wallet.getBalance();
        const master = shorten(this.state.wallet.master_secret);
        return confirm(`This will DELETE your current wallet '${master}' (₩ ${balance})`+
            "\n\nDo you want to continue?");
    }

    onCreateWallet(event) {
        if (!this.confirmOverwriteWallet()) {
            return;
        }
        const wallet = CasaWallet.create();
        wallet.setLegalAgreementsToTrue(); // already agreed on 1st page load
        wallet.save();
        this.replaceWallet(wallet);
    }

    onUploadWallet(event) {
        if (!this.confirmOverwriteWallet()) {
            return;
        }
        const file = event.target.files[0];
        const reader = new FileReader();
        const dis = this;
        reader.onload = function() {
            const walletData = JSON.parse(reader.result);
            const wallet = CasaWallet.create(walletData);
            wallet.setLegalAgreementsToTrue(); // user could have uploaded a wallet without accepted terms
            wallet.save();
            dis.replaceWallet(wallet);
        };
        reader.onerror = function() {
            alert(reader.error);
        };
        reader.readAsText(file);
    }

    onDownloadWallet(event) {
        const filename = 'default_wallet.webcash';
        const contents = this.state.wallet.getContents();
        const jsonContents = JSON.stringify(contents, null, 4);

        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(jsonContents));
        element.setAttribute('download', filename);
        element.style.display = 'none';

        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        this.setState({downloaded: true}, this.saveConfig);
    }

    async onCheckWallet() {
        this.setState({lastCheck: [], inProgress: true});

        // Capture console output from underlying wallet
        const realLog = window.console.log;
        const dis = this;
        const lastCheck = [];
        let key = 0;
        window.console.log = function() {
            realLog.apply(console, arguments);
            const logMessage = [...arguments].join(' ');
            lastCheck.push(<p key={key++}>{logMessage}</p>);
            dis.setState({lastCheck: lastCheck});
        };

        try {
            console.log("(webcasa) Checking wallet");
            await this.state.wallet.check(); // changes wallet contents but doesn't call save()
            await Promise.resolve(); // needed?
            this.saveModifiedWallet(); // TODO: do this only if wallet changed
            console.log("(webcasa) New balance:", this.state.wallet.getBalance().toString());
            console.log("(webcasa) Done!");
        } catch (e) {
            const errMsg = <div className="action-error">{`ERROR: ${e.message}`}</div>;
            this.setState({ lastCheck: <ActionResult success={false} contents={errMsg} /> });
        } finally {
            window.console.log = realLog;
            this.setState({inProgress: false});
        }
    }

    async onRecoverWallet(masterSecret, gapLimit) {
        const sameSecret = masterSecret === this.state.wallet.master_secret;
        if (!sameSecret && !this.confirmOverwriteWallet()) {
            return;
        }

        this.setState({lastRecover: [], inProgress: true});

        // Capture console output from underlying wallet
        const realLog = window.console.log;
        const dis = this;
        const lastRecover = [];
        let key = 0;
        window.console.log = function() {
            realLog.apply(console, arguments);
            if (arguments[0].startsWith('results =')) {
                return;
            }
            const logMessage = [...arguments].join(' ');
            lastRecover.push(<p key={key++}>{logMessage}</p>);
            dis.setState({lastRecover: lastRecover});
        };

        try {
            const wallet = sameSecret
                ? this.state.wallet
                : CasaWallet.create({"master_secret": masterSecret});
            const introMsg = sameSecret
                ? "(webcasa) Updating current wallet (same master secret)"
                : `(webcasa) Replacing current wallet with '${shorten(wallet.master_secret)}'`;
            console.log(introMsg)

            wallet.setLegalAgreementsToTrue();
            await wallet.recover(gapLimit); // changes wallet and calls save() (writes local storage)
            await Promise.resolve();
            console.log("(webcasa) Found balance:", wallet.getBalance().toString());

            if (!sameSecret) {
                this.replaceWallet(wallet);
            }
            this.saveModifiedWallet(true); // TODO: do this only if wallet changed
            console.log("(webcasa) Done!");
        } catch (e) {
            const errMsg = <div className="action-error">{`ERROR: ${e.message} (masterSecret=${masterSecret}, gapLimit=${gapLimit})`}</div>;
            this.setState({ lastRecover: <ActionResult success={false} contents={errMsg} /> });
        } finally {
            window.console.log = realLog;
            this.setState({inProgress: false});
        }
    }

    onSetPassword(password: string) {
        this.state.wallet.setPassword(password);
        this.state.wallet.save();
        if (!this.state.encrypted) {
            this.setState({encrypted: true}, this.saveConfig);
        }
    }

    onUnlockWallet(password): string {
        let err = '';
        const wallet = CasaWallet.load(password);
        if (!wallet) {
            err = "Incorrect password";
        } else {
            this.setState({wallet: wallet});
        }
        return err;
    }

    /* Handle Transfers (webcash operations) */

    async onReceiveWebcash(webcash, memo) {
        try {
            const new_webcash = await this.state.wallet.insert(webcash, memo);
            this.setState({ lastReceive: <ActionResult success={true} contents={new_webcash} title="Success! The new secret was saved" /> });
            this.saveModifiedWallet();
        } catch (e) {
            const errMsg = <div className="action-error">{`ERROR: ${e.message} (webcash=${webcash}, memo=${memo})`}</div>;
            this.setState({ lastReceive: <ActionResult success={false} contents={errMsg} title='' /> });
        } finally {
            if (this.state.externalAction) {
                this.setState({
                    externalAction: null,
                    view: 'Transfers',
                });
                window.history.pushState({}, '', window.location.origin + window.location.pathname);
            }
        }
    }

    async onSendAmount(amount, memo) {
        try {
            const webcash = await this.state.wallet.pay(amount, memo);
            this.setState({ lastSend: {webcash: webcash, memo: memo, error: null} });
            this.saveModifiedWallet();
        } catch (e) {
            const errMsg = <div className="action-error">{`ERROR: ${e.message} (amount=${amount}, memo=${memo})`}</div>;
            this.setState({ lastSend: {webcash: null, memo: null, error: errMsg} });
        }
    }

    /* Render */

    render() {
        let view = '';
        let blur = '';

        // Preempt with modal if there's an external action (e.g. '?receive=...')
        if (this.state.externalAction) {
            blur = 'blur';
            const action = this.state.externalAction[0];
            if (action === 'receive') {
                const params = this.state.externalAction[1];
                view = <ViewExternalReceive webcash={params.webcash} memo={params.memo}
                            onReceiveWebcash={this.onReceiveWebcash} />;
            }
        } else
        // Show password modal if wallet is encrypted
        if (this.state.encrypted && !this.state.wallet) {
            blur = 'blur';
            view = <ViewUnlock onUnlockWallet={this.onUnlockWallet} />;
        } else
        // Preempt with modal if terms are not accepted
        if (!this.state.termsAccepted) {
            blur = 'blur';
            view = <ViewTerms onAcceptTerms={this.onAcceptTerms} />;
        } else
        // Regular view rendering
        if ('Settings' === this.state.view) {
            view = <ViewSettings
                        wallet={this.state.wallet}
                        downloaded={this.state.downloaded}
                        onChangeView={this.onChangeView}
                        onUploadWallet={this.onUploadWallet}
                        onDownloadWallet={this.onDownloadWallet}
                        onCreateWallet={this.onCreateWallet}
                    />;
        } else
        if ('Transfers' === this.state.view) {
            view = <ViewTransfers
                wallet={this.state.wallet}
                onReceiveWebcash={this.onReceiveWebcash} lastReceive={this.state.lastReceive}
                onSendAmount={this.onSendAmount} lastSend={this.state.lastSend}
            />;
        } else
        if ('Secrets' === this.state.view) {
            view = <ViewSecrets wallet={this.state.wallet} />;
        } else
        if ('History' === this.state.view) {
            const logs = this.state.wallet.getContents().log;
            view = <ViewHistory wallet={this.state.wallet} logs={logs}/>;
        } else
        if ('Recover' === this.state.view) {
            view = <ViewRecover wallet={this.state.wallet} onChangeView={this.onChangeView}
                        onRecoverWallet={this.onRecoverWallet} lastRecover={this.state.lastRecover}/>;
        } else
        if ('Check' === this.state.view) {
            view = <ViewCheck wallet={this.state.wallet} onChangeView={this.onChangeView}
                        onCheckWallet={this.onCheckWallet} lastCheck={this.state.lastCheck}/>;
        } else
        if ('Password' === this.state.view) {
            view = <ViewPassword
                        wallet={this.state.wallet}
                        onSetPassword={this.onSetPassword}
                        onChangeView={this.onChangeView}
                    />;
        }

        return (
            <div id="layout" className={`content pure-g ${blur}`}>
                <Navigation
                    wallet={this.state.wallet}
                    onDownloadWallet={this.onDownloadWallet}
                    onChangeView={this.onChangeView}
                />

                {view}

                <div id="tooltip">Copied!</div>
                <div id="this-is-mobile"></div>
            </div>
        );
    }

}
