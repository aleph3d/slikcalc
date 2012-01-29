/**
 * Copyright (c) 2008 Brad Harris - bmharris@gmail.com
 * http://slikcalc.selfcontained.us
 * Code licensed under the MIT License:
 * http://www.opensource.org/licenses/mit-license.php
 * version X.X
 */

var slikcalc;
if(!slikcalc) {
	slikcalc = {};
}else if (typeof slikcalc != 'object') {
	throw new Error('slikcalc already exists and is not an object');
}

slikcalc = {

	adapter : null,

	getValue : function(el) {
		var value = null, element = this.get(el);
		if(element !== null) {
			value = this.isInput(element) ? element.value : element.innerHTML;
		}
		return value;
	},

	setValue : function(el, value) {
		var element = this.get(el);
		if(element !== null) {
			if(this.isInput(element)) {
				element.value = value;
			}else {
				element.innerHTML = value;
			}
		}
	},

	getAmount : function(el) {
		var amount = this.getValue(el);
		amount = amount !== null ? parseFloat(this.formatCurrency(amount)) : parseFloat(this.formatCurrency(0));
		return amount;
	},

	setAmount : function(el, value) {
		this.setValue(el, this.formatCurrency(value));
	},

	isInput : function(element) {
		return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT';
	},

	formatCurrency : function(num) {
		if(num !== undefined && typeof num === "string") {
			num = num.replace(/[$,]/, '');
		}
		num = isNaN(num) || num === '' || num === null ? 0.00 : num;
		return parseFloat(num).toFixed(2);
    },

    trim : function(string) {
		return string.replace(/^\s+|\s+$/g, '');
	},

	get : function(id) {
		this.validateAdapter();
		return this.adapter.get(id);
	},

	validateAdapter : function() {
		if(this.adapter === null) {
			throw new Error('slikcalc requires an external javascript library adapter');
		}
	},

	addListener : function(elementId, type, method, scope) {
		this.validateAdapter();
		this.adapter.addListener(elementId, type, method, scope);
	},

	addOnLoad : function(method, scope) {
		this.validateAdapter();
		this.adapter.addOnLoad(method, scope);
	},

	createCustomEvent : function(eventType) {
		this.validateAdapter();
		return this.adapter.createCustomEvent(eventType);
	},

	bindEvent : function(event, method, scope) {
		this.validateAdapter();
		this.adapter.bindEvent(event, method, scope);
	},

	fireEvent : function(event) {
		this.validateAdapter();
		this.adapter.fireEvent(event);
	},

	extend : function(subc, superc) {
		if (! superc || ! subc) {
			throw new Error('slikcalc.extend failed, please check that all dependencies are included.');
		}

		var F = function() {};
		F.prototype = superc.prototype;
		subc.prototype = new F();
		subc.prototype.constructor = subc;
		subc.prototype.parent = superc.prototype;
		subc.prototype.parent.constructor = superc;
	},

	create : function(type, config) {
		var calcType = type === 'column' ? slikcalc.ColumnCalc : type === 'formula' ? slikcalc.FormulaCalc : null;
		return calcType !== null ? new calcType(config) : null;
	}

};
slikcalc.BaseCalc = function(config) {
    config.total = config.total || {};
	this.totalId = config.total.id || null;
	this.totalOperator = config.total.operator || '+';
	this.calcOnLoad = config.calcOnLoad || false;
	this.calculationComplete = slikcalc.createCustomEvent('calculationComplete');
	this.registerListeners = config.registerListeners || false;
	slikcalc.addOnLoad(this.baseInitialize, this);
};

slikcalc.BaseCalc.prototype = {

	calculationComplete : null,

	lastKeyUp : null,

	calculations : 0,

	totalId : null,

	totalOperator : null,

	calcOnLoad : false,

	registerListeners : false,

	keyupDelay: 600,

	initialized : false,

	baseInitialize : function() {
		if(this.initialized === false) {
			this.initialized = true;
			if(this.initialize !== undefined && typeof this.initialize === 'function') {
				this.initialize();
			}
			if(this.calcOnLoad === true) {
				this.processCalculation();
			}
		}
	},

	dependsOn : function(dependCalc) {
		slikcalc.bindEvent(dependCalc.calculationComplete, this.processCalculation, this);
		return dependCalc;
	},

	triggers : function(triggeredCalc) {
		slikcalc.bindEvent(this.calculationComplete, triggeredCalc.processCalculation, triggeredCalc);
		return triggeredCalc;
	},

	keyupEvent : function() {
		this.lastKeyup = new Date().getTime();
		this.calculations = this.calculations + 1;
		var that = this, calculation = this.calculations;
		setTimeout(function() {
			var currentTime = new Date().getTime(), difference = currentTime - that.lastKeyup;
			if(calculation == that.calculations && difference > that.keyupDelay) {
				that.processCalculation();
			}
		}, (this.keyupDelay+100));
	},

	calculateTotal : function(total, amount) {
		if(this.totalOperator === '+') {
			total = total === null ? 0.00 : total;
            total = total + amount;
        }else if(this.totalOperator === '-') {
			if(total === null) {
				total = amount;
			}else {
				total = total - amount;
			}
		}else if(this.totalOperator === '*' || this.totalOperator === 'x') {
			total = total === null ? 1 : total;
			total = total * amount;
		}else if(this.totalOperator === '/') {
			if(total === null) {
				total = amount;
			}else {
				total = total / amount;
			}
		}
		return total;
	},

	processCalculation: function() {
		if(this.initialized === false) {
			this.baseInitialize();
		}
        this.calculate();
		slikcalc.fireEvent(this.calculationComplete);
	},

	calculate : function() {
		throw new Error('Must implement calculate method in sub-class of BaseCalc');
	}
};
slikcalc.ColumnCalc = function(config) {
	this.parent.constructor.call(this, config);
	this.rows = [];
};
slikcalc.extend(slikcalc.ColumnCalc, slikcalc.BaseCalc);

slikcalc.ColumnCalc.prototype.rows = null;

slikcalc.ColumnCalc.prototype.initialize = function() {
    if(this.registerListeners === true) {
		this.setupEventListeners();
	}
};

slikcalc.ColumnCalc.prototype.calculate = function() {
	var total = null;
	for(var idx in this.rows) {
		if(this.rows.hasOwnProperty(idx)) {
			var includeRow = true;
			if(this.rows[idx].checkbox !== undefined) {
				var checkbox = this.rows[idx].checkbox;
				includeRow = (checkbox.invert !== slikcalc.get(checkbox.id).checked);
			}
			if(includeRow === true) {
				total = this.calculateTotal(total, slikcalc.getAmount(this.rows[idx].id));
			}
		}
	}
	slikcalc.setAmount(this.totalId, total);
};

slikcalc.ColumnCalc.prototype.setupEventListeners = function() {
	for(var idx in this.rows) {
		if(this.rows.hasOwnProperty(idx)) {
			var rowConfig = this.rows[idx];
			if(rowConfig.checkbox !== undefined) {
				slikcalc.addListener(rowConfig.checkbox.id, 'click', this.processCalculation, this);
			}
			slikcalc.addListener(rowConfig.id, 'keyup', this.keyupEvent, this);
		}
	}
};

slikcalc.ColumnCalc.prototype.addRow = function(rowConfig) {
	rowConfig = rowConfig || {};
	if(rowConfig.checkbox !== undefined) {
		rowConfig.checkbox.invert = rowConfig.checkbox.invert || false;
	}
	this.rows.push(rowConfig);
};
slikcalc.FormulaCalc = function(config) {
	this.parent.constructor.call(this, config);
	config = config || {};
	this.formula = config.formula || '';
	this.rows = [];
	this.variables = [];
	if(config.vars !== undefined) {
		this.addRow({ vars : config.vars });
	}
};
slikcalc.extend(slikcalc.FormulaCalc, slikcalc.BaseCalc);

slikcalc.FormulaCalc.prototype.formula = null;

slikcalc.FormulaCalc.prototype.formulaParsed = null;

slikcalc.FormulaCalc.prototype.resultVar = null;

slikcalc.FormulaCalc.prototype.varMatch = /\{(\w)\}/gi;

slikcalc.FormulaCalc.prototype.rows = null;

slikcalc.FormulaCalc.prototype.variables = null;

slikcalc.FormulaCalc.prototype.initialize = function() {
	this.formulaParsed = this.formula;
	if(this.formulaParsed.indexOf('=') !== -1) {
		var formulaSplit = this.formulaParsed.split('=');
		this.formulaParsed = formulaSplit[0];
		this.resultVar = this.varMatch.exec(slikcalc.trim(formulaSplit[1]))[1];
	}
	this.varMatch.lastIndex = 0;
	while((result = this.varMatch.exec(this.formulaParsed)) !== null) {
		this.variables.push(result[1]);
	}
	this.varMatch.lastIndex = 0;
};

slikcalc.FormulaCalc.prototype.addRow = function(rowConfig) {
	rowConfig = rowConfig || {};
	if(rowConfig.checkbox !== undefined) {
		slikcalc.addListener(rowConfig.checkbox.id, 'click', this.processCalculation, this);
		rowConfig.checkbox.invert = rowConfig.checkbox.invert || false;
	}
	for(var idx in rowConfig.vars) {
        if(rowConfig.vars.hasOwnProperty(idx)) {
            var variable = rowConfig.vars[idx];
            variable.defaultValue = variable.defaultValue || 0;
            rowConfig.registerListeners = rowConfig.registerListeners === true || (this.registerListeners === true && rowConfig.registerListeners !== false);
            if(rowConfig.registerListeners === true) {
                slikcalc.addListener(variable.id, 'keyup', this.keyupEvent, this);
            }
        }
	}
	this.rows.push(rowConfig);
};

slikcalc.FormulaCalc.prototype.calculate = function() {
	var total = 0.00;
	for(var idx in this.rows) {
        if(this.rows.hasOwnProperty(idx)) {
            var includeRow = true, rowTotal, formulaString = this.formulaParsed;
            if(this.rows[idx].checkbox !== undefined) {
                var checkbox = this.rows[idx].checkbox;
				includeRow = (checkbox.invert !== slikcalc.get(checkbox.id).checked);
            }
            for(var varIdx in this.variables) {
                if(this.variables.hasOwnProperty(varIdx)) {
                    var variableName = this.variables[varIdx];
                    var variable = this.rows[idx].vars[variableName];
                    var value = variable.defaultValue;
                    if(slikcalc.get(variable.id) !== null) {
                        value = slikcalc.getValue(variable.id);
                        value = value === '' ? variable.defaultValue : value;
                        value = slikcalc.formatCurrency(value);
                    }
                    var variableRegex = new RegExp("\\{" + variableName + "\\}");
                    formulaString = formulaString.replace(variableRegex, value);
                }
            }
            rowTotal = slikcalc.formatCurrency(eval(formulaString));
            if(this.resultVar !== null) {
                var resultId = this.rows[idx].vars[this.resultVar].id;
                slikcalc.setAmount(resultId, rowTotal);
            }
            if(includeRow === true && this.totalOperator !== null) {
				total = this.calculateTotal(total, parseFloat(rowTotal));
            }
        }
	}
	if(this.totalId !== null) {
		slikcalc.setAmount(this.totalId, total);
	}
};
