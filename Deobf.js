const fs = require('fs')
var exec = require('child_process').exec;


const decompress = require("./Utils/Decompress")
const deseralize = require("./Utils/Deseralize")
const luaparse = require("luaparse")
const luac = require('./Utils/LuaC');
const { execSync } = require('child_process');


let script = fs.readFileSync("input.lua")

let info = {}
let buffer;
let typeMapping;
let deseralized;
let structure;

{ // get byteString
    let bs_compressed = /local \w+=\w+\('(\w+)?'\);local \w+=bit/.exec(script)[1]
    let bs = decompress(bs_compressed)
    
    let x = ''
    bs.forEach((v)=>{
        x += String.fromCharCode(v)
    })

    buffer = require("smart-buffer").SmartBuffer.fromBuffer(bs)

}

{ // get structure
    let constants    = /for \w+=1,\w+ do local \w+=\w+\(\);local \w+;if\(/.exec(script);
    let instructions = /for \w+=1,\w+\(\)do local \w+=\w+\(\);if\(\w+\(\w+,1,1/.exec(script);
    let protos       = /for \w+=1,\w+\(\)do \w+\[\w+-1\]=\w+\(\)/.exec(script);
    let parameters   = /\w+\[3\]=\w+\(\);/.exec(script)

    
    let mapping = [constants.index, instructions.index, protos.index, parameters.index].sort()

    for (let i = 0; i < mapping.length; i++) {
        if (mapping[i] == constants.index) {
            mapping[i] = "constants"
        } else if (mapping[i] == instructions.index) {
            mapping[i] = "instructions"
        } else if (mapping[i] == protos.index) {
            mapping[i] = "protos"
        } else if (mapping[i] == parameters.index) {
            mapping[i] = "parameters"
        }
    }

    info["structure"] = mapping
    structure = mapping;
}

{ // Get typeMapping
    let boolean = /if\(\w+==(\w+)?\)then \w+=\(\w+\(\)~=0\)+/.exec(script)[1];
    let number = /elseif\(\w+==(\w+)?\)then \w+=\w+\(\);elseif/.exec(script)[1];
    let string = /elseif\(\w+==(\w+)?\)then \w+=\w+\(\);end/.exec(script)[1];
    
    typeMapping = [boolean, number, string];
    
}

{ // deseralize
    deseralized = deseralize(buffer, typeMapping, structure)

    info["instructions"] = deseralized["instructions"]
    info["constants"] = deseralized["constants"]

}

function isValidInstructionOpcode(opcode) {
    for (let i = 0; i < info["instructions"].length; i++) {
        if (info["instructions"][i].Opcode == opcode) return true
    }
    return false
}

function code2Opcode(code, variable_names) {
    code = code.trimStart();
    code = code.trimEnd();
    
    let regex_codes = {
        28: /local \w+=\w+\[2\]\w+\[\w+\]\(\w+\[\w+\+\w+]\)/.exec(code) // CALL
    }

    let opcodes = {
        [`${variable_names["Stack"]}[${variable_names["Inst"]}[2]]=${variable_names["Env"]}[${variable_names["Inst"]}[3]];`]: 5, // GetGlobal
        ["do return"]: 30, // Return
        ["do return end;"]: 30,
        [`${variable_names["Stack"]}[${variable_names["Inst"]}[2]]=${variable_names["Inst"]}[3];`]: 1, // LOADK
        [`${variable_names["Stack"]}[${variable_names["Inst"]}[1]]=${variable_names["Stack"]}[${variable_names["Inst"]}[2]];`]: 0, // MOVE
        [`${variable_names["Stack"]}[${variable_names["Inst"]}[2]]=${variable_names["Stack"]}[${variable_names["Inst"]}[3]]+${variable_names["Stack"]}[${variable_names["Inst"]}[4]];`]: 12, //OP_ADD

    }

    //console.log(Object.keys(opcodes))
    
    
    if (regex_codes["28"] != null) return 28;


    return opcodes[code] || "Failed to find Opcode!";
}

let opcodes = [];

{ // regex opcode finder - god save me

    let wrap = /while true do(.*)/.exec(script)[1];

    let ifs = wrap.match(/if \w+>(\w+)? then (.+?)else (.+?)end/g)

    let variable_names = {
        "Env": /local function \w+\(\w+,\w+,(\w+)?\)local \w+=\w+\[1\]/.exec(script)[1],
        "Stack": /return function\(...\)local \w+=\w+;local (\w+)=\w+;/.exec(script)[1],
        "Inst": /while true do (\w+)?=\w+\[\w+\];\w+=\w+\[1\];/.exec(script)[1],
    }

    let getOpcode = /if \w+>(\w+)?/

    for (let i = 0; i < ifs.length; i++) {
        let opcode1 = parseInt(getOpcode.exec(ifs[i])[1]) + 1;
        let opcode1_code = /if \w+>\w+ then (.*)else (.*)end/.exec(ifs[i])[1];

        let opcode2 = parseInt(opcode1) - 1;
        let opcode2_code = /if \w+>\w+ then (.*)else (.*)end/.exec(ifs[i])[2]


        if (isValidInstructionOpcode(opcode1)) {
            opcodes[opcodes.length] = {"Enum": opcode1, "Real": code2Opcode(opcode1_code, variable_names)};
        }
        if (isValidInstructionOpcode(opcode2)) {
            opcodes[opcodes.length] = {"Enum": opcode2, "Real": code2Opcode(opcode2_code, variable_names)};
        }
    }
    
}

{ // finalizing opcodes
    let instructions = info["instructions"];
    let newOpcodes = [];

    for (let i = 0; i < instructions.length; i++) {
        for (let opcodeIndx = 0; opcodeIndx < opcodes.length; opcodeIndx++) {
            if(opcodes[opcodeIndx].Enum == instructions[i].Opcode) {
                newOpcodes[i] = opcodes[opcodeIndx]
                instructions[i].Real = opcodes[opcodeIndx].Real
            }
        }
    }

    opcodes = newOpcodes
}

{ // saving to luac
    let newInstructions = []
    
    let instructions = info["instructions"]

    for (let i = 0; i < instructions.length; i++) {
        newInstructions[i] = [
            instructions[i].Type,
            instructions[i].Real
        ]
        switch (instructions[i].Type) {
            case "ABC":
                newInstructions[i][2] = instructions[i].A
                newInstructions[i][3] = instructions[i].B
                newInstructions[i][4] = instructions[i].C
                break;
            case "ABx":
                newInstructions[i][2] = instructions[i].A
                newInstructions[i][3] = instructions[i].B
                break;
            case "AsBx":
                newInstructions[i][2] = instructions[i].A
                newInstructions[i][3] = instructions[i].B
                break;
            case "AsBxC":
                newInstructions[i][2] = instructions[i].A
                newInstructions[i][3] = instructions[i].B
                newInstructions[i][4] = instructions[i].C
                break;
        }
        
    }

    luac({
        constants: info["constants"],
        instructions: newInstructions,
        prototypes: []
    })

    

}

console.log(info)

