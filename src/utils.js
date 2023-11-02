import {
    BigNum,
    Credential,
    Certificate,
    Ed25519KeyHash,
    StakeRegistration,
    StakeDeregistration,
} from "@emurgo/cardano-serialization-lib-asmjs"

// Helper functions

function keyHashStringToCredential (input) {
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
        console.log('Error in parsing credential input, not Hex or Bech32');
        return null;
      }
    }
}


function stringToBigNum (input) {
    try {
        const targetBigNum = BigNum.from_str(input);    
        return targetBigNum;
    } catch (err) {
        console.log(err);
        console.log('Error in deposit amount!');
        return null;
    }
}

// Register Stake Key
export function buildStakeKeyRegCert(certBuilder, stakeCredential, withCoin=false, deposit="2") {
    try {
        const stakeCred = keyHashStringToCredential(stakeCredential);
        let stakeKeyRegCert
        if (withCoin){
            stakeKeyRegCert = StakeRegistration.new_with_coin(stakeCred, stringToBigNum(deposit));
        } else {
            stakeKeyRegCert = StakeRegistration.new(stakeCred);
        }
        certBuilder.add(Certificate.new_stake_registration(stakeKeyRegCert));
        return certBuilder;
    } catch (err) {
        console.log(err);
        return null;
    }
}

// Unregister Stake Key
export function buildStakeKeyUnregCert(certBuilder, stakeCredential, withCoin=false, deposit="2") {
        try {
            const stakeCred = keyHashStringToCredential(stakeCredential);
            let stakeKeyUnregCert
            if (withCoin){
                stakeKeyUnregCert = StakeDeregistration.new_with_coin(stakeCred, stringToBigNum(deposit));
            } else {
                stakeKeyUnregCert = StakeDeregistration.new(stakeCred);
            }
            certBuilder.add(Certificate.new_stake_deregistration(stakeKeyUnregCert));
            return certBuilder;
        } catch (err) {
            console.error(err);
            return null;
        }
}
