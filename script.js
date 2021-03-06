var extensionName = 'Custom Reporters';

var reporters = {};
var CustomReporters = (function(ext) {

    // Cleanup function when the extension is unloaded
    ext._shutdown = function() {};

    // Status reporting code
    // Use this to report missing hardware, plugin or unsupported browser
    ext._getStatus = function() {
        return {status: 2, msg: 'Ready'};
    };
	
	var paramtypes = {
		reporter: 'r',
		bool: 'b'
	};
	
	var functypes = {
		reporter: 'R',
		bool: 'B'
	};
	
	var fragtypes = {
		label: 0,
		inputStr: 1,
		inputNum: 2,
		inputBool: 3
	};
	
	var escapes = {
		string: '%s',
		number: '%n',
		bool: '%b'
	};
	
	//Gets the parameter type that corresponds to the specified frag type.
	var getParamType = function(fragType) {
		return fragType == fragtypes.inputBool ? paramtypes.bool : paramtypes.reporter;
	};

    var refresh = function() {
        ScratchExtensions.unregister(extensionName);
        ScratchExtensions.register(extensionName, descriptor, ext);
    };

    var addBlock = function(data) {
        descriptor.blocks[descriptor.blocks.length] = data;
    };

    var getNewFrag = function(type, data) {
        return {
            type: type,
            data: data
        };
    };
	
	var getHatFunc = function(funcName) { return 'defr_' + funcName; };
	var getParamFunc = function(funcName, paramName) { return 'argr_' + funcName + '_' + paramName; };
	var getReturnFunc = function(funcName) { return 'retr_' + funcName; };
	var getCallFunc = function(funcName) { return 'callr_' + funcName; };
	
	//Creates and returns a new reporter object.
	var getNewReporter = function() {
		return {
			type: functypes.reporter, //Use reporter type by default (booleans also possible)
			hatName: '', //Stores the name that is displayed on the hat block. This name is used basically as the name of the reporter.
			callName: '', //Stores the name that is displayed on the call block.
			funcName: '', //Stores an escaped version of the hatName used for function names. It is used for both the reporter function name and its parameters' functions' names.
			paramCount: 0,
			params: [],
			ready: function() {},
			callback: function() {},
			value: '',
			status: false,
			hat: function() {
				if(this.status === true) {
					this.status = false;
					return true;
				}
				return false;
			},
			call: function(args) {
				for(var i = 0; i < this.paramCount; ++i) {
					this.params[i].write(args[i]);
				}
				this.callback = args[this.paramCount];
				this.ready = function() {
					this.callback(this.value);
					this.ready = function() {};
				}
				this.status = true;
			},
			ret: function(val) {
				this.value = val;
				this.ready();
			}
		};
	};
	
	//Creates and returns a new parameter object with the specified name and type.
	var getNewParam = function(name,type) {
		return {
			type: type,
			name: name,
            value: '',
            read: function()
            {
                return this.value;
            },
            write: function(val)
            {
                this.value = val;
            }
        };
	};
	
	//Parses a block's frags from a block specifier string. (Escape character: _)
	var getFrags = function(data) {
		var frags = [];
		var current = '';
		var i = 0;
		var check = function() {
			if(data.charAt(i) == '_') {
				++i;
				if(i < data.length) {
					current += data.charAt(i);
				}
				return true;
			}
			return false;
		};
		var add = function(type) {
			frags[frags.length] = getNewFrag(type, current);
			current = '';
		};
		for(;i < data.length; ++i) {
			if(!check()) {
				if(data.charAt(i) == '[') {
					add(fragtypes.label);
					i++;
					while(i < data.length && data.charAt(i) != ']') {
						if(!check()) {
							current += data.charAt(i++);
						}
					}
					add(fragtypes.inputStr);
				}
				else if(data.charAt(i) == '<') {
					add(fragtypes.label);
					i++;
					while(i < data.length && data.charAt(i) != '>') {
						if(!check()) {
							current += data.charAt(i++);
						}
					}
					add(fragtypes.inputBool);
				}
				else if(data.charAt(i) == '(') {
					add(fragtypes.label);
					i++;
					while(i < data.length && data.charAt(i) != ')') {
						if(!check()) {
							current += data.charAt(i++);
						}
					}
					add(fragtypes.inputNum);
				}
				else {
					current += data.charAt(i);
				}
			}
		}
		if(current != '') {
			add(fragtypes.label);
		}
		return frags;
	};
	
	//Converts a hatName to a funcName by escaping non-alphanumeric characters.
	var escapeHatName = function(hatName) {
        var escapedName = 'func'; //Make sure definition is consistent; starts with 'func'
        for(var i = 0; i < hatName.length; i++)
        {
			var code = hatName.charCodeAt(i);
			if(
				(code >= 48 && code <= 57) || /* Numbers */
				(code >= 65 && code <= 90) || /* Capital letters */
				(code >= 97 && code <= 122)   /* Lowercase letters */
			) { escapedName += hatName.charAt(i); }
			else { escapedName += '_' + code; } //If character is not alphanumeric, escape ascii code
        }
        return escapedName;
	};
	
	//Applies the given frags to the given reporter.
	var apply = function(frags,reporter) {
		reporter.hatName = ''; //Reset name values
		reporter.callName = '';
		//No need to reset funcName, it will be explicitly set with escapeHatName
		for(var i = 0; i < frags.length; ++i) { //Parse frags and generate names
			switch(frags[i].type) {
				case fragtypes.inputStr:
					reporter.hatName += ' [' + frags[i].data + '] '; //String display
					reporter.callName += escapes.string; //String argument escape
					break;
				case fragtypes.inputNum:
					reporter.hatName += ' (' + frags[i].data + ') '; //Number display
					reporter.callName += escapes.number; //Number argument escape
					break;
				case fragtypes.inputBool:
					reporter.hatName += ' <' + frags[i].data + '> '; //Boolean display
					reporter.callName += escapes.bool; //Boolean argument escape
					break;
				default:
					reporter.hatName += frags[i].data; //Label display
					reporter.callName += frags[i].data; //Function call should have similar label
			}
		}
		reporter.funcName = escapeHatName(reporter.hatName); //Generate funcName; it is needed for parameter functions
		
		reporter.paramCount = 0; //Reset parameters
		reporter.params = [];
		for(var i = 0; i < frags.length; ++i) { //Generate parameters from frags
			if(frags[i].type != fragtypes.label) {
				//add new parameter and increment count
				reporter.params[reporter.paramCount++] = getNewParam(frags[i].data,getParamType(frags[i].type));
			}
		}
	};

	//If a reporter with the same name does not yet exist, add the new reporter
    var addReporter = function(reporter)
    {
		if(!reporters[reporter.funcName]) { //Only add reporter if it doesn't yet exist
			reporters[reporter.funcName] = reporter;

			addBlock(['h','define ' + reporter.hatName,getHatFunc(reporter.funcName)]);
			addBlock([reporter.type,reporter.callName,getCallFunc(reporter.funcName)]);
			var returnType = reporter.type == functypes.reporter ? '%s' : '%b'; //Get return type for function
			addBlock([' ','return ' + returnType + ' for ' + reporter.hatName,getReturnFunc(reporter.funcName)]);
			ext[getHatFunc(reporter.funcName)] = function() { return reporter.hat(); }; //TODO: Come up with better name for hat block function
			ext[getCallFunc(reporter.funcName)] = function() { reporter.call(arguments); };
			ext[getReturnFunc(reporter.funcName)] = function(val) { reporter.ret(val); };

			var addParameter = function(param) {
				addBlock([
					param.type, //block type
					param.name + ' of ' + reporter.hatName, //block name
					getParamFunc(reporter.funcName,param.name) //block func name
				]);
				ext[getParamFunc(reporter.funcName,param.name)] = function() { return param.read(); };
			};
			
			for(var i = 0; i < reporter.params.length; ++i) { //Add parameter blocks
				addParameter(reporter.params[i]);
			}
			
			refresh();
		}
    };
	
	//Tries to parse the reporter and add it.
	var parseReporter = function(data) {
		var reporter = getNewReporter();
		apply(getFrags(data),reporter); //Apply frags *to* reporter (not the other way around)
		addReporter(reporter);
	}
	ext.parseReporter = parseReporter; //Allow ext to access this so that it can call parseReporter() from the reload block

	// Block and block menu descriptions
    var descriptor = {
        blocks: [
            [' ', 'reload reporter %s', 'parseReporter'] //Add the parse reporter block for reloading reporters on green flag
        ]
    };
	
	//Initialize extension
    refresh();
	
	return { //Return some useful things
		paramtypes: paramtypes,
		functypes: functypes,
		fragtypes: fragtypes,
		refresh: refresh,
		getNewFrag: getNewFrag,
		getNewReporter: getNewReporter,
		getFrags: getFrags,
		apply: apply,
		addReporter: addReporter,
		parseReporter: parseReporter
	};
})({});