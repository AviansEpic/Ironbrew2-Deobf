// CREDITS: debug#8888, made by him <3

const luac = "luac.out"
const input = "@input.lua"
const fs = require("fs")

const buffer = new (require("smart-buffer").SmartBuffer)() // i prefer buffers
function writeConstant(a) {
    if (typeof a == "string") {
        buffer.writeUInt8(4)
        buffer.writeUInt32LE(a.length + 1)
        buffer.writeStringNT(a)
    } else if (typeof a == "number") {
        buffer.writeUInt8(3)
        buffer.writeDoubleLE(a)
    } else if (typeof a == "boolean") {
        buffer.writeUInt8(1)
        buffer.writeUInt8(a && 1 || 0)
    }
}

function writeInstruction(a) {
    if (a[0] == "ABC") {
        buffer.writeUInt32LE((a[3] << 9 << 8 << 6) + (a[4] << 8 << 6) + (a[2] << 6) + (a[1]))
    } else if (a[0] == "ABx") {
        buffer.writeUInt32LE((a[3] << 8 << 6) + (a[2] << 6) + (a[1]))
    } else if (a[0] == "AsBx") {
        buffer.writeUInt32LE(((a[3] + 131071) << 8 << 6) + (a[2] << 6) + (a[1]))
    }
}

function writeHeader() {
    buffer.writeString("\x1bLua") // Signature
    buffer.writeUInt8(0x51) // Version (Lua 5.1)
    buffer.writeUInt8(0) // Format
    buffer.writeUInt8(1) // Endianness
    buffer.writeUInt8(4) // Size of Int
    buffer.writeUInt8(4) // Size of T
    buffer.writeUInt8(4) // Instruction size
    buffer.writeUInt8(8) // Number size 
    buffer.writeUInt8(0) // Integral numberes
}

function writeChunkHeader() {
    buffer.writeUInt32LE(input.length + 1)
    buffer.writeStringNT(input)
    buffer.writeUInt32LE(0) // First line defined
    buffer.writeUInt32LE(0) // Last line defined
    buffer.writeUInt8(0) // Upvalue count
    buffer.writeUInt8(0) // Parameter
    buffer.writeUInt8(2) // Is vararg
    buffer.writeUInt8(12) // Register amount (12 does the job in this case)
}

module.exports = function(data) {
    writeHeader()
    writeChunkHeader()

    buffer.writeUInt32LE(data.instructions.length)
    for (let Idx = 0; Idx < data.instructions.length; Idx++) {
        writeInstruction(data.instructions[Idx])
    }

    buffer.writeUInt32LE(data.constants.length)
    for (let Idx = 0; Idx < data.constants.length; Idx++) {
        writeConstant(data.constants[Idx])
    }

    buffer.writeUInt32LE(data.prototypes.length)

    // Useless debug data
    buffer.writeUInt32LE(0) // Source lines
    buffer.writeUInt32LE(0) // Locals
    buffer.writeUInt32LE(0) // Upvalues

    fs.writeFileSync(luac, buffer.toBuffer())
}
