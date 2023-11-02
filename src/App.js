import React from 'react'
import { Tab, Tabs, RadioGroup, Radio, FormGroup, InputGroup } from "@blueprintjs/core";
import "../node_modules/@blueprintjs/core/lib/css/blueprint.css";
import "../node_modules/@blueprintjs/icons/lib/css/blueprint-icons.css";
import "../node_modules/normalize.css/normalize.css";
import {
    Address,
    TransactionUnspentOutput,
    TransactionUnspentOutputs,
    TransactionOutput,
    Value,
    TransactionBuilder,
    TransactionBuilderConfigBuilder,
    LinearFee,
    BigNum,
    TransactionWitnessSet,
    Transaction,
    Credential,
    PublicKey,
    Ed25519KeyHash,
    CertificatesBuilder,
} from "@emurgo/cardano-serialization-lib-asmjs"
import "./App.css";
import {
    buildStakeKeyRegCert,
    buildStakeKeyUnregCert,
} from './utils.js';

let Buffer = require('buffer/').Buffer

class App extends React.Component {
    constructor(props)
    {
        super(props);

        this.state = {
            selectedTabId: "1",
            whichWalletSelected: undefined,
            walletFound: false,
            walletIsEnabled: false,
            walletName: undefined,
            walletIcon: undefined,
            walletAPIVersion: undefined,
            wallets: [],
            networkId: undefined,
            Utxos: undefined,
            balance: undefined,
            changeAddress: undefined,
            rewardAddress: undefined,
            usedAddress: undefined,
            assetNameHex: "4c494645",
            // CIP-95 Stuff
            supportedExtensions: [],
            enabledExtensions: [],
            selected95BasicTabId: "1",
            selected95ActionsTabId: "1",
            selected95MiscTabId: "1",
            selectedCIP95: true,
            // Keys
            dRepKey: undefined,
            dRepID: undefined,
            dRepIDBech32: undefined,
            regStakeKeys: [],
            unregStakeKeys: [],
            regStakeKey: undefined,
            unregStakeKey: undefined,
            regStakeKeyHashHex: undefined,
            unregStakeKeyHashHex: undefined,
            // Txs
            cip95ResultTx: "",
            cip95ResultHash: "",
            cip95ResultWitness: "",
            cip95MetadataURL: undefined,
            cip95MetadataHash: undefined,
            certBuilder: undefined,
            votingBuilder: undefined,
            govActionBuilder: undefined,
            // Certs
            voteDelegationTarget: "",
            voteDelegationStakeCred: "",
            dRepRegTarget: "",
            voteGovActionTxHash: "",
            voteGovActionIndex: "",
            voteChoice: "",
            stakeKeyReg: "",
            stakeKeyCoin: "",
            stakeKeyWithCoin: false,
            stakeKeyUnreg: "",
            // Combo certs
            stakeDelegationTarget: "",
            // Gov actions
            constURL: "",
            constHash: "",
            treasuryTarget: "",
            treasuryAmount: "",
            hardForkUpdateMajor: "",
            hardForkUpdateMinor: "",
        }

        /**
         * When the wallet is connect it returns the connector which is
         * written to this API variable and all the other operations
         * run using this API object
         */
        this.API = undefined;

        this.protocolParams = {
            linearFee: {
                minFeeA: "44",
                minFeeB: "155381",
            },
            minUtxo: "34482",
            poolDeposit: "500000000",
            keyDeposit: "2000000",
            maxValSize: 5000,
            maxTxSize: 16384,
            priceMem: 0.0577,
            priceStep: 0.0000721,
            coinsPerUtxoWord: "34482",
            // Conway Alpha
            votingProposalDeposit: "0",
        }
        this.pollWallets = this.pollWallets.bind(this);
    }

    /**
     * Poll the wallets it can read from the browser.
     * Sometimes the html document loads before the browser initialized browser plugins (like Nami or Flint).
     * So we try to poll the wallets 3 times (with 1 second in between each try).
     *
     * @param count The current try count.
     */
    pollWallets = (count = 0) => {
        const wallets = [];
        for(const key in window.cardano) {
            if (window.cardano[key].enable && wallets.indexOf(key) === -1) {
                wallets.push(key);
            }
        }
        if (wallets.length === 0 && count < 3) {
            setTimeout(() => {
                this.pollWallets(count + 1);
            }, 1000);
            return;
        }
        this.setState({
            wallets,
            whichWalletSelected: wallets[0]
        }, () => {
            this.refreshData()
        });
    }

    handleWalletSelect = (obj) => {
        const whichWalletSelected = obj.target.value
        this.setState({whichWalletSelected},
            () => {
                this.refreshData()
            })
    }

    checkIfWalletFound = () => {
        const walletKey = this.state.whichWalletSelected;
        const walletFound = !!window?.cardano?.[walletKey];
        this.setState({walletFound})
        return walletFound;
    }

    checkIfWalletEnabled = async () => {
        let walletIsEnabled = false;
        try {
            const walletName = this.state.whichWalletSelected;
            walletIsEnabled = await window.cardano[walletName].isEnabled();
        } catch (err) {
            console.log(err)
        }
        this.setState({walletIsEnabled});
        return walletIsEnabled;
    }

    enableWallet = async () => {
        const walletKey = this.state.whichWalletSelected;
        try {
            this.API = await window.cardano[walletKey].enable();
        } catch(err) {
            console.log(err);
        }
        return this.checkIfWalletEnabled();
    }

    getAPIVersion = () => {
        const walletKey = this.state.whichWalletSelected;
        const walletAPIVersion = window?.cardano?.[walletKey].apiVersion;
        this.setState({walletAPIVersion})
        return walletAPIVersion;
    }

    getWalletName = () => {
        const walletKey = this.state.whichWalletSelected;
        const walletName = window?.cardano?.[walletKey].name;
        this.setState({walletName})
        return walletName;
    }

    getSupportedExtensions = () => {
        const walletKey = this.state.whichWalletSelected;
        let supportedExtensions = [];
        try {
            supportedExtensions = window?.cardano?.[walletKey]?.supportedExtensions;
        } catch (err) {
            console.log("Error getting supported extensions")
            console.log(err)
        }
        this.setState({supportedExtensions})
    }

    getEnabledExtensions = async () => {
        try {
            const enabledExtensions = await this.API.getExtensions();
            this.setState({enabledExtensions})
        } catch (err) {
            console.log(err)
        }
    }

    getNetworkId = async () => {
        try {
            const networkId = await this.API.getNetworkId();
            this.setState({networkId})
        } catch (err) {
            console.log(err)
        }
    }

    /**
     * Gets the UTXOs from the user's wallet and then
     * stores in an object in the state
     * @returns {Promise<void>}
     */
    getUtxos = async () => {
        let Utxos = [];
        try {
            const rawUtxos = await this.API.getUtxos();
            for (const rawUtxo of rawUtxos) {
                const utxo = TransactionUnspentOutput.from_bytes(Buffer.from(rawUtxo, "hex"));
                const input = utxo.input();
                const txid = Buffer.from(input.transaction_id().to_bytes(), "utf8").toString('hex');
                const txindx = input.index();
                const output = utxo.output();
                const amount = output.amount().coin().to_str(); // ADA amount in lovelace
                const multiasset = output.amount().multiasset();
                let multiAssetStr = "";
                if (multiasset) {
                    const keys = multiasset.keys() // policy Ids of thee multiasset
                    const N = keys.len();
                    // console.log(`${N} Multiassets in the UTXO`)
                    for (let i = 0; i < N; i++){
                        const policyId = keys.get(i);
                        const policyIdHex = Buffer.from(policyId.to_bytes(), "utf8").toString('hex');
                        // console.log(`policyId: ${policyIdHex}`)
                        const assets = multiasset.get(policyId)
                        const assetNames = assets.keys();
                        const K = assetNames.len()
                        // console.log(`${K} Assets in the Multiasset`)

                        for (let j = 0; j < K; j++) {
                            const assetName = assetNames.get(j);
                            const assetNameString = Buffer.from(assetName.name(),"utf8").toString();
                            const assetNameHex = Buffer.from(assetName.name(),"utf8").toString("hex")
                            const multiassetAmt = multiasset.get_asset(policyId, assetName)
                            multiAssetStr += `+ ${multiassetAmt.to_str()} + ${policyIdHex}.${assetNameHex} (${assetNameString})`
                            // console.log(assetNameString)
                            // console.log(`Asset Name: ${assetNameHex}`)
                        }
                    }
                }
                const obj = {
                    txid: txid,
                    txindx: txindx,
                    amount: amount,
                    str: `${txid} #${txindx} = ${amount}`,
                    multiAssetStr: multiAssetStr,
                    TransactionUnspentOutput: utxo
                }
                Utxos.push(obj);
                // console.log(`utxo: ${str}`)
            }
            this.setState({Utxos})
        } catch (err) {
            console.log(err)
        }
    }

    getChangeAddress = async () => {
        try {
            const raw = await this.API.getChangeAddress();
            const changeAddress = Address.from_bytes(Buffer.from(raw, "hex")).to_bech32()
            this.setState({changeAddress})
        } catch (err) {
            console.log(err)
        }
    }

    getUsedAddresses = async () => {
        try {
            const raw = await this.API.getUsedAddresses();
            const rawFirst = raw[0];
            const usedAddress = Address.from_bytes(Buffer.from(rawFirst, "hex")).to_bech32()
            this.setState({usedAddress})

        } catch (err) {
            console.log(err)
        }
    }

    checkIfCIP95MethodsAvailable = async () => {
        const hasCIP95Methods = ( 
            this.API.cip95.hasOwnProperty('getPubDRepKey') 
            && this.API.cip95.hasOwnProperty('getRegisteredPubStakeKeys')
            && this.API.cip95.hasOwnProperty('getUnregisteredPubStakeKeys'));
        return hasCIP95Methods;
    }

    refreshCIP30State = async () => {
        await this.setState({
            Utxos: null,
            balance: null,
            changeAddress: null,
            rewardAddress: null,
            usedAddress: null,
            supportedExtensions: [],
            enabledExtensions: [],
        });
    }

    refreshCIP95State = async () => {
        await this.setState({
            // Keys
            dRepKey: undefined,
            dRepID: undefined,
            dRepIDBech32: undefined,
            regStakeKeys: [],
            unregStakeKeys: [],
            regStakeKey: undefined,
            unregStakeKey: undefined,
            regStakeKeyHashHex: undefined,
            unregStakeKeyHashHex: undefined,
            // Txs
            cip95ResultTx: "",
            cip95ResultHash: "",
            cip95ResultWitness: "",
            cip95MetadataURL: undefined,
            cip95MetadataHash: undefined,
            certBuilder: undefined,
            votingBuilder: undefined,
            govActionBuilder: undefined,
            // Certs
            voteDelegationTarget: "",
            voteDelegationStakeCred: "",
            dRepRegTarget: "",
            voteGovActionTxHash: "",
            voteGovActionIndex: "",
            voteChoice: "",
            stakeKeyReg: "",
            stakeKeyCoin: "",
            stakeKeyWithCoin: false,
            stakeKeyUnreg: "",
            // Combo certs
            stakeDelegationTarget: "",
            // Gov actions
            constURL: "",
            constHash: "",
            treasuryTarget: "",
            treasuryAmount: "",
            hardForkUpdateMajor: "",
            hardForkUpdateMinor: "",
        });
    }

    /**
     * Refresh all the data from the user's wallet
     * @returns {Promise<void>}
     */
    refreshData = async () => {
        try {
            const walletFound = this.checkIfWalletFound();
            // If wallet found and CIP-95 selected perform CIP-30 initial API calls
            if (walletFound) {
                await this.getAPIVersion();
                await this.getWalletName();
                this.getSupportedExtensions();
                // If CIP-95 checkbox selected attempt to connect to wallet with CIP-95
                let walletEnabled;
                let hasCIP95Methods;
                if (this.state.selectedCIP95) {
                    walletEnabled = await this.enableCIP95Wallet();
                    hasCIP95Methods = await this.checkIfCIP95MethodsAvailable();
                } else {
                    // else connect to wallet without CIP-95
                    walletEnabled = await this.enableWallet()
                    await this.refreshCIP95State();
                }
                // If wallet is enabled/connected
                if (walletEnabled) {
                    // CIP-30 API calls
                    await this.getNetworkId();
                    await this.getUtxos();
                    await this.getBalance();
                    await this.getChangeAddress();
                    await this.getRewardAddresses();
                    await this.getUsedAddresses();
                    await this.getEnabledExtensions();
                    // If connection was CIP95 and wallet has CIP95 methods
                    if (hasCIP95Methods) {
                        // CIP-95 API calls
                        await this.getPubDRepKey();
                        await this.getRegisteredPubStakeKeys();
                        await this.getUnregisteredPubStakeKeys();
                    }
                // else if connection failed, reset all state
                } else {
                    this.setState({walletIsEnabled: false})
                    await this.refreshCIP30State();
                    await this.refreshCIP95State();
                }
            // else if there are no wallets found, reset all state
            } else {
                this.setState({walletIsEnabled: false})
                await this.refreshCIP30State();
                await this.refreshCIP95State();
            }
        } catch (err) {
            console.log(err)
        }
    }

    /**
     * Every transaction starts with initializing the
     * TransactionBuilder and setting the protocol parameters
     * This is boilerplate
     * @returns {Promise<TransactionBuilder>}
     */
    initTransactionBuilder = async () => {
        const txBuilder = TransactionBuilder.new(
            TransactionBuilderConfigBuilder.new()
                .fee_algo(LinearFee.new(BigNum.from_str(this.protocolParams.linearFee.minFeeA), BigNum.from_str(this.protocolParams.linearFee.minFeeB)))
                .pool_deposit(BigNum.from_str(this.protocolParams.poolDeposit))
                .key_deposit(BigNum.from_str(this.protocolParams.keyDeposit))
                .coins_per_utxo_word(BigNum.from_str(this.protocolParams.coinsPerUtxoWord))
                .max_value_size(this.protocolParams.maxValSize)
                .max_tx_size(this.protocolParams.maxTxSize)
                .prefer_pure_change(true)
                .build()
        );
        return txBuilder
    }
    
    /**
     * Builds an object with all the UTXOs from the user's wallet
     * @returns {Promise<TransactionUnspentOutputs>}
     */
    getTxUnspentOutputs = async () => {
        let txOutputs = TransactionUnspentOutputs.new()
        for (const utxo of this.state.Utxos) {
            txOutputs.add(utxo.TransactionUnspentOutput)
        }
        return txOutputs
    }

    getRegisteredPubStakeKeys = async () => {
        try {
            const raw = await this.API.cip95.getRegisteredPubStakeKeys();
            if (raw.length < 1){
                console.log("No Registered Pub Stake Keys");
            } else {
                // Set array
                const regStakeKeys = raw;
                this.setState({regStakeKeys})
                // Just use the first key for now 
                const regStakeKey = regStakeKeys[0];
                this.setState({regStakeKey})
                // Hash the stake key
                const stakeKeyHash = ((PublicKey.from_hex(regStakeKey)).hash()).to_hex();
                this.setState({regStakeKeyHashHex: stakeKeyHash});
                // Set default stake key for vote delegation to the first registered key
                this.setState({voteDelegationStakeCred : stakeKeyHash});
                // Set default stake key to unregister as the first registered key
                this.setState({stakeKeyUnreg : stakeKeyHash});
            }
        } catch (err) {
            console.log(err)
        }
    }

    getUnregisteredPubStakeKeys = async () => {
        try {
            const raw = await this.API.cip95.getUnregisteredPubStakeKeys();
            if (raw.length < 1){
                // console.log("No Registered Pub Stake Keys");
            } else {
                // Set array
                const unregStakeKeys = raw;
                this.setState({unregStakeKeys})
                // Just use the first key for now 
                const unregStakeKey = unregStakeKeys[0];
                this.setState({unregStakeKey})
                // Hash the stake key
                const stakeKeyHash = ((PublicKey.from_hex(unregStakeKey)).hash()).to_hex();
                this.setState({unregStakeKeyHashHex: stakeKeyHash});
                // Set default stake key to register as the first unregistered key
                this.setState({stakeKeyReg : stakeKeyHash});
            }
        } catch (err) {
            console.log(err)
        }
    }

    enableCIP95Wallet = async () => {
        const walletKey = this.state.whichWalletSelected;
        try {
            this.API = await window.cardano[walletKey].enable({extensions: [{cip: 95}]});
        } catch(err) {
            console.log(err);
        }
        return this.checkIfWalletEnabled();
    }

    handleTab95Id = (tabId) => this.setState({selectedTab95Id: tabId})

    handleCIP95Select = () => {
        const selectedCIP95 = !this.state.selectedCIP95;
        console.log("CIP-95 Selected?: ", selectedCIP95);
        this.setState({selectedCIP95});
    }

    buildSubmitConwayTx = async (builderSuccess) => {
        try {
            // Abort if error before building Tx
            if (!(await builderSuccess)){
                throw "Error before building Tx, aborting Tx build."
            }
            // Initialize builder with protocol parameters
            const txBuilder = await this.initTransactionBuilder();
            // Add certs, votes or gov actions to the transaction
            if(this.state.certBuilder){
                txBuilder.set_certs_builder(this.state.certBuilder);
                this.setState({certBuilder : undefined});
            }
            if(this.state.votingBuilder){
                txBuilder.set_voting_builder(this.state.votingBuilder);
                this.setState({votingBuilder : undefined});
            }
            if(this.state.govActionBuilder){
                txBuilder.set_voting_proposal_builder(this.state.govActionBuilder);
                this.setState({govActionBuilder : undefined});
            }
            
            // Set output and change addresses to those of our wallet
            const shelleyOutputAddress = Address.from_bech32(this.state.usedAddress);
            const shelleyChangeAddress = Address.from_bech32(this.state.changeAddress);
            
            // Add output of 3 ADA to the address of our wallet
            // 3 is used incase of Stake key deposit refund
            txBuilder.add_output(
                TransactionOutput.new(
                    shelleyOutputAddress,
                    Value.new(BigNum.from_str("3000000"))
                ),
            );
            // Find the available UTxOs in the wallet and use them as Inputs for the transaction
            await this.getUtxos();
            const txUnspentOutputs = await this.getTxUnspentOutputs();
            // Use UTxO selection strategy 2
            txBuilder.add_inputs_from(txUnspentOutputs, 2)

            // Set change address, incase too much ADA provided for fee
            txBuilder.add_change_if_needed(shelleyChangeAddress)
            // Build transaction body
            const txBody = txBuilder.build();
            // Make a full transaction, passing in empty witness set
            const transactionWitnessSet = TransactionWitnessSet.new();
            const tx = Transaction.new(
                txBody,
                TransactionWitnessSet.from_bytes(transactionWitnessSet.to_bytes()),
            );

            // Ask wallet to to provide signature (witnesses) for the transaction
            let txVkeyWitnesses;
            txVkeyWitnesses = await this.API.signTx(Buffer.from(tx.to_bytes(), "utf8").toString("hex"), true);
            // Create witness set object using the witnesses provided by the wallet
            txVkeyWitnesses = TransactionWitnessSet.from_bytes(Buffer.from(txVkeyWitnesses, "hex"));
            transactionWitnessSet.set_vkeys(txVkeyWitnesses.vkeys());
            // Build transaction with witnesses
            const signedTx = Transaction.new(
                tx.body(),
                transactionWitnessSet,
            );
            
            console.log("SignedTx: ", Buffer.from(signedTx.to_bytes(), "utf8").toString("hex"))
            // console.log("Signed Tx: ", signedTx.to_json());
            
            // Submit built signed transaction to chain, via wallet's submit transaction endpoint
            const result = await this.API.submitTx(Buffer.from(signedTx.to_bytes(), "utf8").toString("hex"));
            console.log("Built and submitted transaction: ", result)
            // Set results so they can be rendered
            const cip95ResultTx = Buffer.from(signedTx.to_bytes(), "utf8").toString("hex");
            const cip95ResultHash = result;
            const cip95ResultWitness = Buffer.from(txVkeyWitnesses.to_bytes(), "utf8").toString("hex");
            this.setState({cip95ResultTx});
            this.setState({cip95ResultHash});
            this.setState({cip95ResultWitness});
            // Reset anchor state
            this.setState({cip95MetadataURL : undefined});
            this.setState({cip95MetadataHash : undefined});

        } catch (err) {
            console.log("Error during build, sign and submit transaction");
            console.log(err);
            await this.refreshData();
        }
    }

    addStakeKeyRegCert = async () => {
        const certBuilder = CertificatesBuilder.new();

        const certBuilderWithStakeReg = buildStakeKeyRegCert(
            certBuilder, 
            this.state.stakeKeyReg,
            this.state.stakeKeyWithCoin,
            this.state.stakeKeyCoin,
        );
            
        // messy having this here
        if (!this.state.stakeKeyWithCoin){
            this.protocolParams.keyDeposit = this.state.stakeKeyCoin
        }
        if (certBuilderWithStakeReg){
            this.setState({certBuilder : certBuilderWithStakeReg});
            return true;
        } else {
            return false;
        }
    }


    addStakeKeyUnregCert = async () => {
        const certBuilder = CertificatesBuilder.new();
        const certBuilderWithStakeUnreg = buildStakeKeyUnregCert(
            certBuilder, 
            this.state.stakeKeyUnreg,
            this.state.stakeKeyWithCoin,
            this.state.stakeKeyCoin,
        );
        // messy having this here
        if (!this.state.stakeKeyWithCoin){
            this.protocolParams.keyDeposit = this.state.stakeKeyCoin
        }
        if (certBuilderWithStakeUnreg){
            this.setState({certBuilder : certBuilderWithStakeUnreg});
            return true;
        } else {
            return false;
        }
    }

    handleInputToCredential = async (input) => {
        try {
          const keyHash = Ed25519KeyHash.from_hex(input);
          const cred = Credential.from_keyhash(keyHash);
          return cred;
        } catch (err1) {
          try {
            const keyHash = Ed25519KeyHash.from_bech32(input);
            const cred = Credential.from_keyhash(keyHash);
            return cred;
          } catch (err2) {
            console.error('Error in parsing credential, not Hex or Bech32:', err1, err2);
            return null;
          }
        }
    }

    async componentDidMount() {
        this.pollWallets();
        await this.refreshData();
    }

    render(){
        return (
            <div style={{margin: "20px"}}>

                <h1>✨stake key reg dApp✨</h1>

                <input type="checkbox" checked={this.state.selectedCIP95} onChange={this.handleCIP95Select}/> Enable CIP-95?

                <div style={{paddingTop: "10px"}}>
                    <div style={{marginBottom: 15}}>Select wallet:</div>
                    <RadioGroup
                        onChange={this.handleWalletSelect}
                        selectedValue={this.state.whichWalletSelected}
                        inline={true}
                        className="wallets-wrapper"
                    >
                        { this.state.wallets.map(key =>
                            <Radio
                                key={key}
                                className="wallet-label"
                                value={key}>
                                <img src={window.cardano[key].icon} width={24} height={24} alt={key}/>
                                {window.cardano[key].name} ({key})
                            </Radio>
                        )}
                    </RadioGroup>
                </div>
                <button style={{padding: "20px"}} onClick={this.refreshData}>Refresh</button> 
                <hr style={{marginTop: "10px", marginBottom: "10px"}}/>
                <p><span style={{fontWeight: "bold"}}>Use CIP-95 .signTx(): </span></p>
                <p><span style={{fontWeight: "lighter"}}> Random Stuff</span></p>
                
                <Tabs id="cip95-misc" vertical={true} onChange={this.handle95TabId} selectedTab95Id={this.state.selected95MiscTabId}>
                    <Tab id="1" title="🔑 Register Stake Key" panel={
                        <div style={{marginLeft: "20px"}}>

                            <label>
                                <input
                                    type="checkbox"
                                    style={{ paddingRight: "10px" }}
                                    checked={this.state.stakeKeyWithCoin}
                                    onChange={() => this.setState({ stakeKeyWithCoin: !this.state.stakeKeyWithCoin })}
                                />
                                <span style={{ paddingLeft: '10px' }}>Use the new Conway Stake Registration Certificate (with coin)</span>
                            </label>

                            <FormGroup
                                label="Stake Key Hash"
                                style={{ paddingTop: "10px" }}
                            >
                                <InputGroup
                                    disabled={false}
                                    leftIcon="id-number"
                                    onChange={(event) => this.setState({stakeKeyReg : event.target.value})}
                                    value={this.state.stakeKeyReg}
                                />
                            </FormGroup>
                            <FormGroup
                                helperText="This should align with current protocol parameters (in lovelace)"
                                label="Stake Key Deposit Amount"
                            >
                                <InputGroup
                                    disabled={false}
                                    leftIcon="id-number"
                                    onChange={(event) => this.setState({stakeKeyCoin : event.target.value})}
                                    value={this.state.stakeKeyCoin}
                                />
                            </FormGroup>

                            <button style={{padding: "10px"}} onClick={ () => this.buildSubmitConwayTx(this.addStakeKeyRegCert()) }>Build, .signTx() and .submitTx()</button>

                        </div>
                    } />
                    <Tab id="2" title="🚫🔑 Unregister Stake Key" panel={
                        <div style={{marginLeft: "20px"}}>
                            <label>
                                <input
                                    type="checkbox"
                                    style={{ paddingRight: "10px" }}
                                    checked={this.state.stakeKeyWithCoin}
                                    onChange={() => this.setState({ stakeKeyWithCoin: !this.state.stakeKeyWithCoin })}
                                />
                                 <span style={{ paddingLeft: '10px' }}>Use the new Conway Stake Unregisteration Certificate (with coin)</span>
                            </label>

                            <FormGroup
                                helperText=""
                                label="Stake Key Hash"
                                style={{ paddingTop: "10px" }}
                            >
                                <InputGroup
                                    disabled={false}
                                    leftIcon="id-number"
                                    onChange={(event) => this.setState({stakeKeyUnreg : event.target.value})}
                                    value={this.state.stakeKeyUnreg}
                                />
                            </FormGroup>
                            
                            <FormGroup
                                helperText="This should align with how much was paid during registration (in lovelace)"
                                label="Stake Key Deposit Refund Amount"
                            >
                                <InputGroup
                                    disabled={false}
                                    leftIcon="id-number"
                                    onChange={(event) => this.setState({stakeKeyCoin : event.target.value})}
                                    value={this.state.stakeKeyCoin}
                                />
                            </FormGroup>

                            <button style={{padding: "10px"}} onClick={ () => this.buildSubmitConwayTx(this.addStakeKeyUnregCert()) }>Build, .signTx() and .submitTx()</button>
                        </div>
                    } />
                    <Tab id="3" title=" 💯 Test Basic Transaction" panel={
                        <div style={{marginLeft: "20px"}}>

                            <button style={{padding: "10px"}} onClick={ () => this.buildSubmitConwayTx(true) }>Build, .signTx() and .submitTx()</button>

                        </div>
                    } />
                    <Tabs.Expander />
                </Tabs>
                
                <hr style={{marginTop: "10px", marginBottom: "10px"}}/>

                <p><span style={{fontWeight: "bold"}}>CborHex Tx: </span>{this.state.cip95ResultTx}</p>
                <p><span style={{fontWeight: "bold"}}>Tx Hash: </span>{this.state.cip95ResultHash}</p>
                <p><span style={{fontWeight: "bold"}}>Witnesses: </span>{this.state.cip95ResultWitness}</p>

                <hr style={{marginTop: "10px", marginBottom: "10px"}}/>
                
                <h5>✨Powered by CSL 12 alpha 12✨</h5>
            </div>
        )
    }
}

export default App;