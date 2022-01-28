//wantDirectory -> true if the func has to return list of directories
//fullSearch -> if false it will search for dir only directly inside of pathToLibrary, or for files directly inside of this directories
const fs = require('fs');
const { log } = console;
var listToOrder = new Array();
//var firstMovableIndex = 0;
function search(pathToLibrary = '', requestedFIle = '', wantDirectory = false, suffix = '', fullSearch = false)
{
    if(!pathToLibrary.endsWith('/')) pathToLibrary += '/';
    if(!fullSearch)
    {
        let directories = fs.readdirSync(pathToLibrary);
        if(wantDirectory)
        {
            for(let i = 0; i < directories.length; i++)
            {
                let pathToDir = pathToLibrary + directories[i];
                if(fs.lstatSync(pathToDir).isDirectory()) listToOrder.push(pathToDir);
            }
        }
        else //wantDirectory == false
        {
            for(let i = 0; i < directories.length; i++)
            {
                let pathToDir = pathToLibrary + directories[i];
                if(fs.lstatSync(pathToDir).isFile()) listToOrder.push(pathToDir);
            }   
        }
    }
    else //Fullsearch
    {
        if(wantDirectory)
        {
            searchForDir_recursion(pathToLibrary);
        }
        else //wantDirectory == false
        {
            searchForFiles_recursion(pathToLibrary);
        }
    }
    //Sorting algorithm below
    let orderedList = listToOrder.slice();
    let accuracyPoints = new Array(orderedList.length).fill(0);
    for(let i = 0; i<listToOrder.length; i++)
    {
        let d = listToOrder[i].length -1;
        while(listToOrder[i][d] !== '/') d--;
        d++;
        listToOrder[i] = listToOrder[i].slice(d).toLowerCase();
    }
    requestedFIle = requestedFIle.toLowerCase();
    //Checking if there is file with name the same as reqested
    for(let i = 0; i < listToOrder.length; i++)
    {
        if(listToOrder[i] === requestedFIle)
        {
            accuracyPoints[i] += 100;
            break;
        }
    }
    splittedReq = requestedFIle.split(' ');
    for(let i = 0; i < listToOrder.length; i++)
    {
        for(let i2 = 0; i2 < splittedReq.length; i2++)
        {
            if(suffix !== '')
            {
                if(!(listToOrder[i].endsWith(suffix)))
                {
                    accuracyPoints[i] = -100;
                }
            }
            if(listToOrder[i].indexOf(splittedReq[i2]) >= 0)
            {
                accuracyPoints[i]++;
            }
        }
    }
    //Sorting arrays by the accuracy poins from the highest to the lowest
    let flag = true;
    do
    {
    	flag = false;
    	for(let i = 0; i < accuracyPoints.length-1; i++)
    	{
    		if(accuracyPoints[i] < accuracyPoints[i+1])
	    	{
                //Sorting accuracyPoints
	    		let tmp = accuracyPoints[i];
	    		accuracyPoints[i] = accuracyPoints[i+1];
	    		accuracyPoints[i+1] = tmp;
                //Sorting listToOrder
                tmp = listToOrder[i];
	    		listToOrder[i] = listToOrder[i+1];
	    		listToOrder[i+1] = tmp;
                //Sorting orderedList
                tmp = orderedList[i];
	    		orderedList[i] = orderedList[i+1];
	    		orderedList[i+1] = tmp;
                //Resetting flag in order to continue loop
	    		flag = true;
	    	}
	    }
    }while(flag);
    //Removing all indexes with accuracy below or equal to 0
    let lastAcceptableIndex = 0; //Will be bigger by 1 from actual last acceptable index, but for array.slice that's good
    while(accuracyPoints[lastAcceptableIndex] > 0)
    {
        lastAcceptableIndex++;
    }
    accuracyPoints = accuracyPoints.slice(0, lastAcceptableIndex);
    listToOrder = listToOrder.slice(0, lastAcceptableIndex);
    orderedList = orderedList.slice(0, lastAcceptableIndex);
    return orderedList;
}

//Code only for testing purposes
//let arr = search(process.argv[2], 'test', true, '', true);
//log(arr[0]);
//log(arr[1]);

//Functions
function searchForDir_recursion(dir)
{
    let directories = fs.readdirSync(dir);
    for(let i = 0; i < directories.length; i++)
    {
        let pathToDir = dir + directories[i];
        if(fs.lstatSync(pathToDir).isDirectory())
        {
            listToOrder.push(pathToDir);
            if(!pathToDir.endsWith('/')) pathToDir += '/';
            searchForDir_recursion(pathToDir);
        }
    }
    return;
}

function searchForFiles_recursion(dir)
{
    let directories = fs.readdirSync(dir);
    for(let i = 0; i < directories.length; i++)
    {
        let pathToDir = dir + directories[i];
        if(fs.lstatSync(pathToDir).isFile())
        {
            listToOrder.push(pathToDir);
        }
        else if(fs.lstatSync(pathToDir).isDirectory())
        {
            if(!pathToDir.endsWith('/')) pathToDir += '/';
            searchForFiles_recursion(pathToDir);
        }
    }
    return;
}

//Exporting
module.exports.search = search;