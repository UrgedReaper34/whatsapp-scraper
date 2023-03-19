const fs = require("fs")
var n = "default"
var name = `./WAScraperDataset(${n}).json`
fs.readFile(name, (err, data) => {
    if(err){
        console.log(err)
    }
    var d = JSON.parse(data)
    console.log(`Data length: ${d.trainY.length}\nTest length:${d.testY.length}`)
    console.log(`X length: ${d.trainX.length}\nY length:${d.trainY.length}`)
})