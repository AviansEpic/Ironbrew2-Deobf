function decompress(bs) {
    // Lempel-Ziv Compression
    let marker = 0
    let dictionary = Array(256).fill(0).map((v,i) => String.fromCharCode(i))
    function read() {
        let length = parseInt(bs[marker],36)
        marker++
        let value = parseInt(bs.substring(marker, marker+length), 36)
        marker += length
        //console.log(value)
        return value
    }

    let previous = String.fromCharCode(read())
    let returnValue = []
    returnValue.push(previous)
    while(marker < bs.length) {
        let entry = read()
        let word
        if(dictionary[entry]) {
            word = dictionary[entry]
        } else {
            word = previous + previous[0]
        }
        dictionary.push(previous + word[0])
        //console.log(`Entry ${dictionary.length-1} now ${previous + word[0]}`)
        returnValue.push(word)
        previous = word
    }
    let key = returnValue[1].charCodeAt();
    let buff = Buffer.from(returnValue.map (v=>v.split("").map(x=>x.charCodeAt(0))).flat())
    return buff.map(v => v ^ key) 
}

module.exports = decompress