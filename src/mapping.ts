import { near, log, BigInt, json, JSONValueKind } from "@graphprotocol/graph-ts";
import { NftMint } from "../generated/schema";

export function handleReceipt(receipt: near.ReceiptWithOutcome): void {
  const actions = receipt.receipt.actions;
  
  for (let i = 0; i < actions.length; i++) {
    handleAction(
      actions[i], 
      receipt.receipt, 
      receipt.block.header,
      receipt.outcome,
      receipt.receipt.signerPublicKey
      )
  }
}

function handleAction(
  action: near.ActionValue,
  receipt: near.ActionReceipt,
  blockHeader: near.BlockHeader,
  outcome: near.ExecutionOutcome,
  publicKey: near.PublicKey
): void {
  
  if (action.kind != near.ActionKind.FUNCTION_CALL) {
    log.info("Early return: {}", ["Not a function call"])
    return
  }
  
  const functionCall = action.toFunctionCall();
  
  // change the methodName here to the methodName emitting the log in the contract
  if (functionCall.methodName == "nft_mint") {
      const receiptId = receipt.id.toBase58()
      // Maps the JSON formatted log to the LOG entity
      let mints = new NftMint(`${receiptId}`)

      // Standard receipt properties
      mints.blockTime = BigInt.fromU64(blockHeader.timestampNanosec/1000000)
      mints.blockHeight = BigInt.fromU64(blockHeader.height)
      mints.blockHash = blockHeader.hash.toBase58()
      mints.predecessorId = receipt.predecessorId
      mints.receiverId = receipt.receiverId
      mints.signerId = receipt.signerId
      mints.signerPublicKey = publicKey.bytes.toBase58()
      mints.gasBurned = BigInt.fromU64(outcome.gasBurnt)
      mints.tokensBurned = outcome.tokensBurnt
      mints.outcomeId = outcome.id.toBase58()
      mints.executorId = outcome.executorId
      mints.outcomeBlockHash = outcome.blockHash.toBase58()

      // Log Parsing
      if(outcome.logs !=null && outcome.logs.length > 0){
     
        if(outcome.logs[0].split(':')[0] == 'EVENT_JSON'){

          // this part is required to turn the paras contract EVENT_JSON into valid JSON
          let delimiter = ':'
          let parts = outcome.logs[0].split(delimiter)
          parts[0] = '"EVENT_JSON"'
          let newString = parts.join(delimiter)
          let formatString = '{'+newString+'}'
          let parsed = json.fromString(formatString)

          
          if(parsed.kind == JSONValueKind.OBJECT){
            let entry = parsed.toObject()

            //EVENT_JSON
            let eventJSON = entry.entries[0].value.toObject()

            //standard, version, event (these stay the same for a NEP 171 emmitted log)
            for(let i = 0; i < eventJSON.entries.length; i++){
              let key = eventJSON.entries[i].key.toString()
              switch (true) {
                case key == 'standard':
                  mints.standard = eventJSON.entries[i].value.toString()
                  break
                case key == 'event':
                  mints.event = eventJSON.entries[i].value.toString()
                  break
                case key == 'version':
                  mints.version = eventJSON.entries[i].value.toString()
                  break
                case key == 'data':
                  let j = 0
                  let dataArray = eventJSON.entries[i].value.toArray()
                  while(j < dataArray.length){
                    let dataObject = dataArray[j].toObject()
                    for(let k = 0; k < dataObject.entries.length; k++){
                      let key = dataObject.entries[k].key.toString()
                      switch (true) {
                        case key == 'owner_id':
                          mints.owner_id = dataObject.entries[k].value.toString()
                          break
                        case key == 'token_ids':
                          let tokenArray = dataObject.entries[k].value.toArray()
                          for(let m = 0; m < tokenArray.length; m++){
                            mints.token_ids.push(tokenArray[m].toString())
                          }
                          //mints.token_ids.push(dataObject.entries[k].value.toString())
                          // let tokenArray = dataObject.entries[k].value.toArray()
                          // let m = 0
                          // while (m < tokenArray.length){
                          //   if(tokenArray[m].toString().length > 0){
                          //     mints.token_ids = tokenArray[m].toString()
                          //   }
                          //   m++
                          // }
                          break
                      }
                    }
                    j++
                  }
                  break
              }
            }
          }
          mints.save()
        }
      }
      
  } else {
    log.info("Not processed - FunctionCall is: {}", [functionCall.methodName]);
  }
}
