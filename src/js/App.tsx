import React from "react";
import { WebcashWalletLocalStorage } from "webcash";

import { Navigation } from "./Navigation";
import { ViewHistory } from "./ViewHistory";
import { ViewReceive } from "./ViewReceive";
import { ViewSecrets } from "./ViewSecrets";
import { ViewSend } from "./ViewSend";
import { ViewWallet } from "./ViewWallet";

export class App extends React.Component {

    constructor(props) {
        super(props);
        this.handleMenuClick = this.handleMenuClick.bind(this);
        this.handleUploadWallet = this.handleUploadWallet.bind(this);
        this.handleDownloadWallet = this.handleDownloadWallet.bind(this);
        this.handleCreateWallet = this.handleCreateWallet.bind(this);
        this.handleModifyWallet = this.handleModifyWallet.bind(this);
        this.state = {
            view: 'Wallet',
            wallet: WebcashWalletLocalStorage.load() ?? new WebcashWalletLocalStorage(),
            saved: true, // did the user download the latest wallet file
        };
        var dat = this;
        window.addEventListener("beforeunload", function(e) {
            if (!dat.state.saved) {
                e.preventDefault();
                return e.returnValue = "You didn't download your updated wallet. Are you sure you want to exit?";
            }
        });
    }

    render() {
        var view = '';
        if ('Wallet' === this.state.view) {
            view = <ViewWallet
                        wallet={this.state.wallet}
                        saved={this.state.saved}
                        handleUploadWallet={this.handleUploadWallet}
                        handleDownloadWallet={this.handleDownloadWallet}
                        handleCreateWallet={this.handleCreateWallet}
                    />;
        } else
        if ('Send' === this.state.view) {
            view = <ViewSend wallet={this.state.wallet} handleModifyWallet={this.handleModifyWallet} />;
        } else
        if ('Receive' === this.state.view) {
            view = <ViewReceive wallet={this.state.wallet} handleModifyWallet={this.handleModifyWallet} />;
        } else
        if ('Secrets' === this.state.view) {
            view = <ViewSecrets wallet={this.state.wallet} />;
        } else
        if ('History' === this.state.view) {
            const logs = this.state.wallet.getContents().log;
            view = <ViewHistory wallet={this.state.wallet} logs={logs}/>;
        }

        return (
            <div id="layout" className="content pure-g">
                <div id="tooltip">Copied!</div>
                <Navigation
                    wallet={this.state.wallet}
                    saved={this.state.saved}
                    handleDownloadWallet={this.handleDownloadWallet}
                    handleMenuClick={this.handleMenuClick}
                />
                {view}
            </div>
        );
    }

    replaceWallet(wallet: WebcashWallet): bool {
        if (this.state.saved === false) {
            alert("First download the wallet (to avoid losing your recent changes)");
            return false;
        } else {
            this.setState({wallet: wallet});
            wallet.save();
            return true;
        }
    }

    handleMenuClick(itemName) {
        this.setState({view: itemName});
    }

    handleCreateWallet(event) {
        const wallet = new WebcashWalletLocalStorage();
        this.replaceWallet(wallet);
    }

    handleModifyWallet() {
        this.state.wallet.save();
        this.setState({
            saved: false,
            wallet: this.state.wallet // force repaint of navbar etc
        });
    }

    handleUploadWallet(event) {
        const file = event.target.files[0];
        const reader = new FileReader();
        const dis = this;

        reader.onload = function() {
            const walletData = JSON.parse(reader.result);
            const wallet = new WebcashWalletLocalStorage(walletData);
            dis.replaceWallet(wallet);
        };
        reader.onerror = function() {
            alert(reader.error);
        };
        reader.readAsText(file);
    }

    handleDownloadWallet(event) {
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
        this.setState({saved: true});
    }

}
