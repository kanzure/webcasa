import React from "react";

import { formatDate } from "./_util";
import { List, Row } from "./Common";

export class FormReceive extends React.Component {

    constructor(props) {
        super(props)
        this.onChange = this.onChange.bind(this);
        this.onSubmit = this.onSubmit.bind(this);
        this.state = {
            receiveWebcash: '',
            receiveMemo: '',
        };
    }

    onChange(event) {
        event.preventDefault();
        const target = event.target;
        this.setState({
            [target.id]: target.value
        });
    }

    async onSubmit() {
        event.preventDefault();
        const webcash = this.state.receiveWebcash;
        const memo = this.state.receiveMemo;
        await this.props.onReceiveWebcash(webcash, memo);
    }

    render() {
        var key = 0;
        const history = this.props.wallet.log
            .filter((x) => x.type === "receive" || x.type === "insert" )
            .slice(-100).reverse().map((x) => {
                const ts = !x.timestamp ? null : formatDate(new Date(Number(x.timestamp)));
                return <div className="list-item" key={key++}>
                    <Row title='timestamp' contents={ts} />
                    <Row title='amount' contents={x.amount} />
                    <Row title='memo' contents={x.memo} />
                    <Row title='webcash' contents={x.webcash} isWebcash={true} />
                    <Row title='new_webcash' contents={x.new_webcash} isWebcash={true} />
                </div>;
            });
        return (
            <div id="FormReceive">

                <form className="pure-form pure-form-stacked" onSubmit={this.onSubmit}>
                    <fieldset>
                        <label htmlFor="receiveWebcash">Webcash</label>
                        <input type="text" id="receiveWebcash" onChange={this.onChange}
                               required value={this.state.receiveWebcash}
                               spellCheck='false' autoCorrect='off' autoComplete='off'/>
                    </fieldset>
                    <fieldset>
                        <label htmlFor="receiveMemo">Memo</label>
                        <input type="text" id="receiveMemo" onChange={this.onChange} value={this.state.receiveMemo}
                               maxLength="64"
                               spellCheck='false' autoCorrect='off' autoComplete='off'/>
                    </fieldset>
                    <div className="centered">
                        <button type="submit" className="pure-button pure-button-primary">Insert in wallet</button>
                    </div>
                </form>

                {this.props.lastReceive}

                <List title="History" items={history} />

            </div>
        );
    }
}
