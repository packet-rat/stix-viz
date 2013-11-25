var path = require('path');
var tree = require('./public/js/StixRelationshipTree');
var graph = require('./public/js/StixRelationshipGraph');

var xmlDocs = {}, docIndex = 0;

var working = 0;

var view = null,
data=null,
layout=null;

/**
 * Mapping from node type to sections headings in the HTML rendering
 */
var htmlSectionMap = { 
	"ThreatActors":"Threat Actors",
	"TTPs":"TTPs",
	"Indicators":"Indicators",
	"Campaigns":"Campaigns",
	"CoursesOfAction":"Courses of Action",
	"Incidents":"Incidents",
	"ExploitTargets":"Exploit Targets",
	"Observables":"Observables"
};

/**
 * Mapping from node type to icon names to be used in the tree display
 */
var typeIconMap = {
	"ThreatActors" : "ThreatActor",
	"TTPs" : "TTP",
	"CourseOfAction" : "Course of Action",
	"CoursesOfAction" : "Course of Action",
	"AttackPattern" : "TTP",
	"Indicator" : "Indicator",
	"MalwareBehavior" : "TTP",
	"Observable" : "Observable",
	"Observable-ElectronicAddress" : "Observable",
	"Observable-Email" : "Observable",
	"Observable-IPRange" : "Observable",
	"Indicators" : "Indicator",
	"Campaigns" : "Campaign",
	"campaign" : "Campaign",
	"Observable" : "Observable",
	"Observables" : "Observable",
	"Observable-MD5" : "Observable",
	"Observable-URI" : "Observable",
	"ObservedTTP" : "TTP",
	"threatActor" : "ThreatActor",
	"UsesTool" : "TTP",
	"Tools" : "TTP",
	"VictimTargeting" : "Victim",
	"Indicator-Utility" : "Indicator",
	"Indicator-Composite" : "Indicator",
	"Indicator-Backdoor" : "Indicator",
	"Indicator-Downloader" : "Indicator",
	"Incident" : "Incident",
	"Incidents" : "Incident",
	"Exploit" : "ExplotTarget",
	"ExploitTarget" : "ExplotTarget",
	"ExploitTargets" :  "ExplotTarget",
	"top" : "Report"
};


$(function () { 
	/**
	 *  Add handler for file select input
	 */
	$('#files').on('change', function () { handleFileSelect($(this)); });
	

	/**
	 *  Initialize the page layout. North section is nav menu, center is the tree view, south is the HTML view
	 */
	layout = $('body').layout({ 
		defaults: { 
			resizable:true,
			fxName:'slide',
			fxSpeed:'slow'
		},
		north: { 
			size:"auto",
			spacing_open:			0,			// cosmetic spacing
			togglerLength_open:		0,			// HIDE the toggler button
			togglerLength_closed:	-1,			// "100%" OR -1 = full width of pane
			resizable: 				false,
			slidable:				false,		//	override default effect
			fxName:					"none"
		},
		center: { 
			minSize:400
		},
		south: {
			initClosed:true,
			size:300
		} 			
	});
	
	
	
	/**
	 *  Append svg container for tree
	 */
	svg = d3.select("#treeView").append("svg")
    .append("g")
    .attr("transform","translate(" + margin.left + "," + margin.top + ")");

	/**
	 *  define color filter for lightening non-expandable nodes
	 */
	svg.append("defs")
	.append("filter")
	.attr("id","lighten")
	.append("feColorMatrix")
		.attr("type","matrix")
		.attr("values","1 .5 .5 0 0  .5 1 .5 0 0  .5 .5 1 0 0  0 0 0 1 0");
	

	/**
	 * When the window is resized, resize and update the tree 
	 */
	$(window).resize(function (e) { 
		view.resize();
	});
	
	
	
	
	/**
	 * Handler for top level Show HTML button
	 */
	$('#showHtml').on('click',function () {
		$("#contextMenu").hide();
		showHtmlByContext(contextNode);
	});
	
	
	$('#selectView .viewItem').on('click', function () {
		var viewType = $(this).val();
		if (viewType === 'tree') { 
			view = new StixTree();
		} elif (viewType === 'graph') {
			view = new StixGraph();
		};
		if (data) { 
			view.display(data);
		};
	});


	/**
	 * If there's a context menu open, you can hide it by clicking somewhere else in the document
	 */
	$(document).click(function () { 
		$('#contextMenu').hide();
	});
	
	
});

/**
 * Add an XML document to the list of documents included in the tree display and process the XSLT transform
 * for that document
 * @param f
 * @param xml
 */
function addXmlDoc (f) { 
	
	working++;
	var num = docIndex++;
	
	xmlDocs[num] = {name:f.name};
	
	xmlFilePath = f.path.replace(/\\/g,'\\\\\\\\');
	xslFilePath = path.resolve("public/xslt/stix_to_html.xsl").replace(/\\/g,'\\\\\\\\');
	
	instance.sendXsltRequest(num,xmlFilePath,xslFilePath);
	
	// Construct top level menu for displaying HTML view of XML files
	$('#xmlFileList').append('<li><a id="xmlFile-'+num+'" href="#">'+f.name+'</a></li>');

	$('#xmlFile-'+num).on("click", function () {
		doc = xmlDocs[$(this).attr("id").split("-")[1]];
		if (doc) { 
			showProcessing();
			var waitForXslt = setInterval(function () { // wait until xslt processing is complete
				if (working == 0) { 
					clearInterval(waitForXslt);
					endProcessing();
					showHtml(new XMLSerializer().serializeToString($(doc.html).find('#wrapper').get(0)));
				}
			}, 200);
		} else { 
			showHtml("<div id='wrapper'><h2>Could not convert XML file to HTML</h2></div>");
		}
		$('#htmlView').scrollTop(0);
    });
	
}


function displayJson (jsonString) { 
	data = jsonString;
	view.display(data);
}


/**
 * Show HTML view for a given node. 
 *  If the node has an id, find and scroll to the DOM element with that id, otherwise find the DOM element that matches 
 *  the type section header. 
 * @param data The node selected to show HTML
 */
function showHtmlByContext (data) {
	showProcessing();
	var waitForXslt = setInterval(function () { // wait until xslt processing is complete
		if (working == 0) { 
			clearInterval(waitForXslt);
			endProcessing();
			var nodeid = getId(data);
			if (nodeid) {
				var found = false;
				$.each(xmlDocs, function (i,entry) {
					if ($(entry.html).find(".topLevelCategory .expandableContainer[data-stix-content-id='"+nodeid+"']").get(0) != undefined) {
						showHtml(new XMLSerializer().serializeToString($(entry.html).find('#wrapper').get(0)));
						var objRef = $(".topLevelCategory .expandableContainer[data-stix-content-id='"+nodeid+"']"); 
						objRef.find('tr').eq(0).addClass("infocus");
						objRef.get(0).scrollIntoView();
						expandSection(objRef);
						found = true;
						return false;
					} else { 
						return true;
					}
				});
				// If we get here, there was no entry in xmldocs for the given node
				if (!found) { 
					showHtml("<div id='wrapper'><h2>Could not convert XML file to HTML</h2></div>");
				}
			} else { 
				var section = htmlSectionMap[data.type];
				$.each(xmlDocs, function (i,entry) {
					if ($(entry.html).find("h2 > a:contains('"+section+"')").get(0) != undefined) {
						showHtml(new XMLSerializer().serializeToString($(entry.html).find('#wrapper').get(0)));
						$("h2 > a:contains('"+section+"')").get(0).scrollIntoView();
						return false;
					} else { 
						return true;
					}
				});
			}
		}
	}, 200);
}


function showProcessing () { 
	
	
	$('#htmlView').empty();
	$('#htmlView').addClass('loading');
	$('#htmlView').append('<div id="loadingMessage"><h3> <img src="public/icons/spinner.gif"> Processing XML Transform</h3></div>');
	layout.open("south");
}

function endProcessing () { 
	
	$('#htmlView').removeClass('loading');
	$('#htmlView').empty();
}


/**
 * display the given HTML in the HTML view panel
 * @param html
 */
function showHtml (html) { 
	$('#htmlView').empty();
	layout.open("south");
	
	$('#htmlView').append(html);
	
	// Handlers to highlight associated tree nodes on mouseenter/mouseleave
	$(".topLevelCategory .expandableContainer[data-stix-content-id] tr:has(.expandableToggle)").on("mouseenter", function () { 
		$(this).addClass("infocus");
		highlightDuplicateNodes($(this).parents(".expandableContainer").data("stix-content-id"));
	});

	$(".topLevelCategory .expandableContainer[data-stix-content-id] tr:has(.expandableToggle)").on("mouseleave", function () {
		$(this).removeClass("infocus");
		removeHighlightedNodes();
	});
	

}

/**
 * Expand a given node in the HTML and then expand all of the nested expandable nodes (uses stix_to_html function
 * to expand nested expandables).
 * @param node
 */
function expandSection (node) { 
	node.find('.expandableToggle').click();
	expandNestedExpandables(node.get(0));
}




/**
 *  Reset the display when new XML files are loaded
 */
function reset () { 
	xmlDocs = {};
	docIndex = 0;
	$('#xmlFileList').empty();
	svg.selectAll().remove(); // remove everything
	$('#htmlView').empty();
	layout.close("south");
}



/**
 * Handle the selection of input file(s)
 * @param fileinput
 */
function handleFileSelect(fileinput) {
	
    var mime = require('mime');
		
    var files = fileinput.get(0).files;

    // If only one JSON file was loaded (for testing purposes only)
    if (files.length == 1 && mime.lookup(files[0].name).match('application/json')) { 
    	// remove old xml docs
    	reset();

        var reader = new FileReader();

        // Closure to capture the file information.
        reader.onload = (function(theFile) {
          return function(e) {
            displayTree(e.target.result);
          };
        })(files[0]);

        // Read in the JSON file as text
        reader.readAsText(files[0]);

    } else { // When one or more XML files are selected

    	reset();     	// remove old xml docs and reset display
    	
    	$(files).each(function (index, f) {
    		var mimetype = mime.lookup(f.name);

    		// Only process xml files.
    		if (!mimetype.match('application/xml')) {
    			return;
    		}
    	});


    	// create json tree structure from xml files read in
    	generateTreeJson(files);
    }

};



/**
 * Highlight the div in the HTML view corresponding to the given nodeId
 * @param nodeId
 */
function highlightHtml (nodeId) { 
	if (!nodeId) return;
	$(".topLevelCategory .expandableContainer[data-stix-content-id='"+nodeId+"'] tr").eq(0).addClass("infocus");
}


/**
 * Remove all node highlighting
 */
function removeHighlightedNodes () { 
	svg.selectAll("rect.nodeborder").remove();
}



/**
 * Highlight all nodes in the tree that match the given nodeId. 
 * 
 * @param nodeId The id of the node to highlight
 */
function highlightDuplicateNodes (nodeId) { 
	if (!nodeId) return;
	var matches = d3.selectAll(".node").filter(function (d) { 
		return d.nodeId == nodeId || d.nodeIdRef == nodeId;
	});
	matches.append("rect")
	.attr("height", String(nodeHeight+10)+"px")
	.attr("width", String(nodeWidth+10)+"px")
	.attr("rx","10")
	.attr("ry","10")
	.attr("class","nodeborder")
	.attr("transform","translate("+ -(nodeWidth+10)/2 + "," + "-5" + ")");
}
