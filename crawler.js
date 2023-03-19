/*
Hi! This is a crawler I made with the JS version of Puppeteer. 
This script crawls a Whatsapp chat that exists between two people (no group chats) and saves their text messages, excluding images and other attachments, into a JSON file.
It saves the data into 4 arrays for machine learning, training data (trainX), training labels (trainY), testing data (testX), and testing labels (testY)
It uses the console (via the readline library) to receive its instructions.
Any comments part of my explanation that I added (that are not part of the original file) will be denoted with a + sign in front of the comment.
*/
//+
const puppeteer = require('puppeteer-core');
const readline = require('readline');
const fs = require("fs");
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;

function sleep(ms){

    return new Promise(resolve => {
        setTimeout(ms, resolve())
    })
}
var tabClass;
var page;
var browser;
var config = {
    equalSides: true,
    //+ For every 9 messages one will be saved to the test dataset
    validation_split: 10,
}
var status = 0;
console.log("Initialising...")
var mainDb = {
    X: [],
    Y: [],
    trainX: [], 
    trainY: [], 
    testX: [], 
    testY: []
}
var startTime;
//+ creates an interface for interaction with the console
var RL = readline.createInterface(process.stdin, process.stdout);
RL.on('line', async (text) => {
    var allParams = text.split(",")
    switch(allParams[0]){
        //+ Setup command issued in the console
        case "setup":
            //+ Lets you know the current working directory
            exec("pwd", function(error, stdout2, stderr){

            //+ I wrote a shell script so I wouldn't have to run so many shell commands in Javascript. Much easier for me.    
            var cmd = spawn("./init.sh")
            cmd.stdout.on("data", (data) => {
                //+ Whenever something is logged to the console, this executes
                var replies = data.toString().split("\n")
                for(x in replies){
                    var str = "DevTools listening on "
                    if(replies[x].includes(str)){
                        fs.writeFile("./config.json", JSON.stringify({url: replies[x].substring(0, replies[x].indexOf(str) + str.length)})) 
                        console.log("Success")
                    }
                }
            })
            cmd.stderr.on("data", (data) => {
               //+ Whenever an error is logged to the console
                var replies = data.toString().split("\n")
                for(x in replies){
                    var str = "DevTools listening on "
                    if(replies[x].includes(str)){
                        fs.writeFile("./config.json", JSON.stringify({url: replies[x].substring(replies[x].indexOf(str) + str.length)}), function(e){
                            if(e){
                                console.error(e)
                            }
                        }) 
                        console.log("Success")
                    }
                }
            });
            
            cmd.on('error', (error) => {
                console.log(error.message);
            });
            
            cmd.on("close", (code) => {
                console.log(`Exited with code ${code}`);
            });
    
})
            break;

        case "launch":
            //+ Executes when the launch command is issued on the console
            try{
            /*var url = JSON.parse(fs.readFileSync("./config.json")).url;
                browser = await puppeteer.connect({
                browserWSEndpoint: url,
                
            })*/
            //+ Launches puppeteer with the version of Chrome I use (not Chromium which comes preinstalled), and uses a specific chrome profile for this project
            browser = await puppeteer.launch({
                headless: false,
                executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                args: ["--user-data-dir=/Users/shaneyeo21/Library/Application Support/Google/Chrome/Profile 7"]
            })
                page = await browser.newPage()
                
                page.goto('https://web.whatsapp.com/');
                console.log("Launched!")
            
        } catch (e){
            console.log(e)
        }
                
                break;
        case "nc":
        case "navigateChat":
           var uniqueID = `x${Math.ceil(Math.random() * 8999999 + 1000000)}`
            console.log(uniqueID)
            try{
                //+ allParams[1] is a parameter for the specific chat name that you want to scrape.
            await page.$eval(`[dir="auto"][title="${allParams[1]}"]`, (elm, uniqueID) => {
                //+ Every whatsapp chat has a div containing all the elements relating to each message.
                //+ This marks the parent div with our unique ID, so we can locate it easily in the future.
                var x = elm.closest(`[aria-label="Chat list"] > div > [role="row"]`)
                x.setAttribute("id", `${uniqueID}`)
               
                return uniqueID
                
            }, uniqueID);
            var parent = await page.$(`#${uniqueID}`)
            
            parent.click()
            } catch(e){
                console.log(e)
            }
            //+ This commented code is functionality I removed that was supposed to throw an error if the script detected multiple chats with the same name.
            //+ I removed it because I did not intend on using this script to scrape more than one chat.
            /*(roomList, allParams, page) => {
                
                if(roomList.length == 0){
                    return "No chatroom with that name found.";
                } 
                if(roomList.length > 1){
                    return "More than one chatroom with that name found."
                }
                var tabClass = document.querySelector('[aria-label="Chat list"] div').classList[0]
                    var tabs = document.querySelectorAll(`${tabClass}`)
                    //console.log(tabs)
                    
                    tabs.forEach((x) => {
                        if(x.querySelector(`[dir="auto"][title="${allParams[1]}"]`) != null){
                        x.click()
                        console.log("Navigating to chat now.")
                    }})  
                        
                    
            
                
            }*/
            break;
            case "scrape":
            startTime = Date.now()
            //+ This commented code was an experiment using createWriteStream to store data in 4 different files. For the sake of simplicity, I did not opt to use this route, but for large amounts of data it would be best to use this method.
            /*var names = ["./data2/STest.json", "./data2/JTest.json", "./data2/STrain.json", "./data2/JTrain.json"]
            var trainStream1 = fs.createWriteStream(names[0])
            var trainStream2 = fs.createWriteStream(names[1])
            var testStream1 = fs.createWriteStream(names[2])
            var testStream2 = fs.createWriteStream(names[3])
            */
            console.log("Scraping...")
            
            function scrapeMessages(){
                //+ Some context before we dive into the code.
                //+ How Whatsapp Web works (at least as of the time this script was written) was that:
                //+ 1. The message elements fell under a parent element.
                //+ 2. Since Whatsapp cant display your entire chat history at once, these messages are loaded in bits and pieces. Each group of messages that are loaded would fall in the above mentioned parent element.
                //+ 3. Every time you scroll up, another group of messages are loaded.
                //+ 4. A lock screen icon reminding you of Whatsapp's end to end encryption is always the first message regardless of chat.
                //+ Thus there are 3 groups of elements. The message element itself, the message group element (the parent of the message elements) and the parent of the message group element, where the message groups are procedurally loaded.
                //+ So what this program does is it scrapes through all the messages in a message group, then moves on the the next message group. 
                //+ Once all message groups are scraped, it scrolls to the top, forcing WhatsApp to load more message groups.
                //+ This cycle repeats until a lock icon is found. (see 4.) This indicates we are at the end of the chat.
                return new Promise(async (resolve, reject) => {
                    page.waitForSelector(`[aria-label="Message list. Press right arrow key on a message to open message context menu."]`)
                    .then(async (val) => {
                        if(val == null){
                            return true;
                        }
                    //+ This searches for the message group element with a specific characteristic, in this case the aria-label attribute.
                    var msgParent = await page.$(`[aria-label="Message list. Press right arrow key on a message to open message context menu."]`)
                    try{
                        //+ evaluate() runs code on an element in the DOM.
                        msgParent.evaluate((msgList) => {
                            //+ This code denotes who sent what.
                            //1 = user, 2 = other person
                            var data = {
                                X: [], 
                                Y: [], 
                                
                            }
                            
                            //+ For every child of the paent element (ie messages) it will execute the following code
                            msgList.childNodes.forEach((element) => {
                                if(!element.classList.contains("scanned")){
                                //+ This check is here in case for some reason the message was not scanned earlier.
                                element.classList.add("scanned")
                                //+ This selects the span element that contains the message content.
                                var text = element.querySelector("span.i0jNr.selectable-text span")
                                
                                
                                if(text != null){
                                //+ If the search does not come up empty-handed (ie not an image or document message)    
                                    console.log(text.innerText)
                                    if(element.classList.contains("message-out")){
                                        //user's message
                                        //+ Add the message content to the database along with the appropriate label
                                        data[`Y`].push("1")
                                        data[`X`].push(text.innerText)
                                    } else if(element.classList.contains("message-in")){

                                        data[`Y`].push("2")
                                        data[`X`].push(text.innerText)
                                    } else {
                                        console.log("Error: unknown sender")
                                    }
                                    
                                }
                                
                            } else {
                                
                            }
                            })
                            
                            return data;

                        }) //evaluate

                        .then(data => {
                            //+ Adds the data to the databases
                            mainDb.X = mainDb.X.concat(data.X)
                            mainDb.Y =  mainDb.Y.concat(data.Y)
                            msgParent.evaluate(async (c) => {
                                //+ c in this case refers to the msgParent element in the DOM.
                                var g = c.querySelector(`[data-testid="lock-small"][data-icon="lock-small"]`)
                                for(x in c.childNodes){
                                    if(x > 20){
                                        c.removeChild(c.childNodes[x])
                                    }
                                }
                                c.childNodes[0].scrollIntoView(true)
                                //+ If the lock icon is not detected, the function will return with true.
                                if(g == null){
                                    //scrapeMessages()
                                    return true;
                                } else {
                                    return false;
                                }

                            })
                            .then(ans => {
                                //msgParent.dispose()
                                resolve(ans)
                            })
                            .catch(e => {
                                console.log("Error in second evaluate of scrape:\n", e)
                                reject(e)
                            })
                        //:first

                        })
                        .catch(e => {
                            console.log("Error in first evaluate of scrape:\n", e)
                            reject(e)
                        })
                    } catch(e){
                        console.log("Error in first evaluate of scrape:\n", e)
                            reject(e)
                            return false;
                    }
                    })
                    .catch((e) => {
                        //console.log(e)
                        reject(e)
                    })  
                    })
                }
                
                function main(){
                    return new Promise((resolve, reject) => {
                    if(status != 0){
                    scrapeMessages().then((ans) => {
                        //+ ans returns true if the lock icon has not been found/end of chat has not been detected
                        if(ans){
                            //+ Recursive function
                            main().then((xc) => {
                                resolve(xc)
                                //+ xc refers to the final database, so the function will resolve the database all the way up the long chain of recursion
                            })
                            return false;
                        } else {
                            console.log("Finished!")
                            resolve(mainDb)
                            return false;
                        }
                    })
                    .catch((e) => {
                        console.log(e)
                        main().then((xc) => {
                            resolve(xc)
                        })
                    })
                } else {
                    //+ This resolves false when the status code has changed
                    console.log("Stopping")
                    resolve("false")
                    return false;
                }
                    })
                
                }
                status = 1;
                main().then((msg) => {
                    if(msg = "false"){
                        //+ THis happens only if the main() function has been interrupted by a change of status code.
                        return false;
                    }
                    console.log("Cleaning data...")
                    console.log(`Seconds elapsed since start: ${(Date.now() - startTime) / 1000}`)
                    var mainDB = mainDb
                    //+ did this because I wrote the wrong variable name
                    console.log(mainDB)
                    //data cleaning
                    
                    var equalised;
                    cleanDB = {
                        trainX: mainDB.X,
                        trainY: mainDB.Y,
                        testX: [],
                        testY: []
                    }

                    if(config.equalSides){
                        //+ config.equalSides is a configuration option that places an equal amount of data from both types of labels into each dataset
                        equalised = equalise(mainDB.Y, mainDB.X)
                        cleanDB = {
                            trainX: equalised.X,
                            trainY: equalised.Y,
                            testX: [],
                            testY: []
                        }
                    }
                    
                    //test variables
                    for(c in cleanDB.trainX){
                        //every nth element
                        if(c % 10 == 0){
                            //takes the nth element of the data array and pushes it into the test array
                            cleanDB.testX.push(cleanDB.trainX.splice(c, 1)[0])
                            cleanDB.testY.push(cleanDB.trainY.splice(c, 1)[0])
                        }
                    }
                    //Finished data cleaning!
                    console.log("Piping data...")
                    var data = JSON.stringify(cleanDB)
                    console.log(data)
                    var name = `./WAScraperDataset(${allParams[1]}).json`
                    fs.writeFile(name, data, function(e){
                        if(e){
                           return console.log(e)
                        }
                        
                        console.log(`Dataset created successfully at ${name}`)
                        console.log(`Operation finished in ${(Date.now() - startTime) / 1000}s`)
                    })
                })

            
        break;
        case "help":
            console.log("Command List:\nsetup (deprecated): Launchs chrome with a wssocket connection\nlaunch: Launches puppeteer with a constant user-profile.\nnc/navigateChat,(chatName): Navigates to a chat")
            break;
        case "save":
            //+ Another command that does the data cleaning without the scraping.
            console.log("Saving...")
            if(allParams[1] == undefined){
                allParams[1] = "default"
            }
            var name = `./WAScraperDataset(${allParams[1]}).json`
            fs.readFile(name, (err, dataX) => {
                    if(err){
                        console.log("Error: File not found, creating a new one")
                        console.log(err)
                        dataX = `{"trainX":[],"trainY":[],"testX":[],"testY":[]}`;
                    }
                
                    console.log("Cleaning data...")
                    console.log(`Seconds elapsed since start: ${(Date.now() - startTime) / 1000}`)
                    var mainDB = mainDb
                    console.log(mainDB)
                    //data cleaning?
                    
                    var equalised;
                    cleanDB = {
                        trainX: mainDB.X,
                        trainY: mainDB.Y,
                        testX: [],
                        testY: []
                    }
                    if(config.equalSides){
                        equalised = equalise(mainDB.Y, mainDB.X)
                        cleanDB = {
                            trainX: equalised.X,
                            trainY: equalised.Y,
                            testX: [],
                            testY: []
                        }
                    }
                    mainDb = {
                        X: [],
                        Y: [],
                        trainX: [], 
                        trainY: [], 
                        testX: [], 
                        testY: []
                    }

                    
                    //test variables
                    for(c in cleanDB.trainX){
                        //every nth element
                        if(c % 10 == 0){
                            //takes the nth element of the data array and pushes it into the test array
                            cleanDB.testX.push(cleanDB.trainX.splice(c, 1)[0])
                            cleanDB.testY.push(cleanDB.trainY.splice(c, 1)[0])
                        }
                    }
                    //Finished data cleaning!
                    console.log("Concatenating data...")
                    var data = JSON.parse(dataX)
                    var arr = ["trainX", "trainY", "testX", "testY"]
                    for(x in arr){
                        cleanDB[arr[x]] = data[arr[x]].concat(cleanDB[arr[x]])
                    }
                    console.log("Piping data...")
                    var data = JSON.stringify(cleanDB)
                    console.log(data)
                    var name = `./WAScraperDataset(${allParams[1]}).json`
                    fs.writeFile(name, data, function(e){
                        if(e){
                           return console.log(e)
                        }
                        
                        console.log(`Dataset created successfully at ${name}`)
                        console.log(`Operation finished in ${(Date.now() - startTime) / 1000}s`)
                    })
                
                
            })
            break;
        case "stop":
            status = 0;
            console.log("Queuing stop...")
        default:
    }
});
function ID(){
    return `x${Math.ceil(Math.random() * 8999999 + 1000000)}`;
}
function equalise(labelsX,dataX){
    //+ This is the function that ensures an equal amount of data marked with the two different labels
    var labels = labelsX;
    var data = dataX;
    //data cleaning.
    //+ "1" and "2" are the labels for the client and the other party sending messages respectively.
    var splitDB = {
        "1": [],
        "2": []
    };

    for(x in labels){
        //+ sorts data by label e.g label 1 data goes into group 1
        splitDB[labels[x]].push(data[x])
    }
    
    
    
    var diff, base, a, b;
    if(splitDB["1"].length > splitDB["2"].length){
        //theres more of 1 than 2, we need to remove some
        a = "1";
        b = "2";
    } else if (splitDB["1"].length < splitDB["2"].length){
        a = "2";
        b = "1";
    } 
    diff = splitDB[a].length - splitDB[b].length;
    
    var interval = Math.floor(splitDB[a].length / diff)
    var rem;
    for(x in splitDB[a]){
        if(x / interval == 0){
            //+ removes every nth datapoint, where n is interval
            var rem = splitDB[a].splice(x, 1)
            data.splice(data.indexOf(rem), 1)
            labels.splice(data.indexOf(rem), 1)
        }
    }
    //+ Since interval was rounded, there will still be inaccuracies. This trims off the datapoints at the end of the array.
    while(splitDB[a].length < splitDB[b].length){
        rem = splitDB[b].splice(splitDB[b].length - 1, 1)
        data.splice(data.indexOf(rem), 1)
        labels.splice(data.indexOf(rem), 1)
    }
    while(splitDB[a].length > splitDB[b].length){
        rem = splitDB[a].splice(splitDB[a].length - 1, 1)
        data.splice(data.indexOf(rem), 1)
        labels.splice(data.indexOf(rem), 1)
    }
    
        
        
        if(splitDB["1"].length != splitDB["2"].length){
            console.warn("Warning: Imbalance in equaliser!")
            console.log(splitDB["1"].length, splitDB["2"].length)
            console.log(labels)
            console.log(labels.length)
            console.log(data)
            console.log(data.length)
            return {"Y": labels, "X": data};
        } else {
            return {"Y": labels, "X": data};
        }
}
/* 
RL.question(`More than one chatroom found. Choose one:${function(){
                            var str;
                            for(x in roomList){
                                str += `\\n${x + 1}: ${roomList[x].innerHTML}\\nLast sent message: ${page.evaluate(() => document.querySelectorAll(`${tabClass}`).classList[0]).then((tabs) => {
                                    for(x in tabs){
                                        if(page.evaluate(() => tabs[x].querySelector('[dir="auto"][title="${allParams[1]}"]')).then((result) => {
                                            if(result == null){
                                                return false
                                            } else {
                                                return true;
                                            }
                                        })){
                                            
                                        }
                                    }
                                })}`
                            }
                        }}`, (name)=>{
                            console.log(name);
                        });
                        /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --no-first-run --no-default-browser-check --user-data-dir=$(mktemp -d -t 'chrome-remote_data_dir')
                        */
  

console.log("Initialised!")