
const { SmartBuffer } = require("smart-buffer")

let Pos = 0

function readConstants(buffer, typeMapping) {
    let constantLength = buffer.readUInt32LE();
    let constants = [];

    
    for(let _ = 0; _ < constantLength; _++) {
        const type = buffer.readUInt8();
        
        if (type == typeMapping[0]) {
            constants[constants.length] = Boolean(buffer.readUInt8())
        } else if(type == typeMapping[1]) {
            constants[constants.length] = buffer.readDoubleLE();
        } else if(type == typeMapping[2]) {
            constants[constants.length] = buffer.readString(buffer.readUInt32LE());
        }
    }

    return constants;
}

function readInstructions(buffer) {
    let instrLength = buffer.readUInt32LE();
    let instructions = [];
    
    for (let _ = 0; _ < instrLength; _++) {
        
        let instruction = buffer.readUInt8()
        
        if ((instruction & 1) == 0) {
            const Inst = [
                buffer.readUInt16LE(), 
                buffer.readUInt16LE(), 
                null,
                null
            ];

            const Type = (instruction & 6) >> 1;
            let TypeStr = ""
            let betterDict = {"Type": TypeStr, "Opcode": Inst[0], "A": Inst[1]}

            if (Type == 0) {
                TypeStr = "ABC"
                Inst[2] = buffer.readUInt16LE()
                Inst[3] = buffer.readUInt16LE();
                betterDict["B"] = Inst[2];
                betterDict["C"] = Inst[3];
            } else if (Type == 1) {
                TypeStr = "ABx"
                Inst[2] = buffer.readUInt32LE();
                betterDict["B"] = Inst[2] - 1;
            } else if (Type == 2) {
                TypeStr = "AsBx"
                Inst[2] = buffer.readUInt32LE() - 65536;
                betterDict["C"] = Inst[2];
            } else if (Type == 3) {
                TypeStr = "AsBxC"
                Inst[2] = buffer.readUInt32LE() - 65536;
                Inst[3] = buffer.readUInt32LE();
                betterDict["B"] = Inst[2];
                betterDict["C"] = Inst[3];
            }

            betterDict["Type"] = TypeStr;

            instructions[instructions.length] = betterDict;
        }
    }

    return instructions;
}

function parameters(buffer) {
    buffer.readUInt8()
}

function protos(buffer, typeMapping, structureMapping) {
    let length = buffer.readUInt32LE();
    for (let i = 0; i < length; i++) {
        deseralize(buffer, typeMapping, structureMapping)
    }
}

function deseralize(buffer, typeMapping, structureMapping) {
    let mapping = {
        "constants": readConstants,
        "instructions": readInstructions,
        "protos": protos,
        "parameters": parameters
    }

    structureMapping.forEach(a => {
        mapping[a] = mapping[a](buffer, typeMapping, structureMapping);

    });

    return {
        "constants": mapping["constants"],
        "instructions": mapping["instructions"],
        "protos": mapping["protos"],
        "parameters": parameters
    }
}


module.exports = deseralize
