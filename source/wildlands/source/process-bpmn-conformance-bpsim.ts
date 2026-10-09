/// <reference path="./process-bpmn-conformance-model.ts" />
/**
 * Conformance rules for BPSim 1.0 (namespace http://www.bpsim.org/schemas/1.0), in the notation of
 * `process-bpmn-conformance-model.ts`: scenarios and their parameters, every parameter group and parameter, the constant,
 * enumeration, expression and distribution values with their exact attribute names, calendars and result requests.
 * BPSim content is found inside BPMN `extensionElements` (usually of a `relationship` of type BPSimData), where BPMN accepts
 * foreign content laxly; these rules make it checked instead of skipped. Restated as Wildlands data, no schema file is read.
 */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessBpmnRulesBpsim?: LWProcessBpmnRules.Api};
 /** Constant values and distributions share the parameter value base (`validFor`, `instance`, `result`); units travel on numbers and distributions. */
 const UNITS = 'timeUnit:TimeUnit currencyUnit:string', P = '=Parameter?';
 const bpsim: LWProcessBpmnRules.Table = {ns: 'http://www.bpsim.org/schemas/1.0', prefix: 'bpsim', typePrefix: '',
  // Only these are top-level; Scenario and the parameter groups exist only inside their parents.
  elements: [
   'BPSimData=_Data ParameterValue UserDistributionDataPoint=_DataPoint EnumParameter<ParameterValue=_Enum ExpressionParameter<ParameterValue=_Expression',
   'StringParameter<ParameterValue=_String NumericParameter<ParameterValue=_Numeric FloatingParameter<ParameterValue=_Floating BooleanParameter<ParameterValue=_Boolean',
   'DurationParameter<ParameterValue=_Duration DateTimeParameter<ParameterValue=_DateTime UserDistribution<ParameterValue=_User',
   'LogNormalDistribution<ParameterValue=_MeanSd NormalDistribution<ParameterValue=_MeanSd TruncatedNormalDistribution<ParameterValue=_Truncated',
   'PoissonDistribution<ParameterValue=_Mean NegativeExponentialDistribution<ParameterValue=_Mean ErlangDistribution<ParameterValue=_Erlang',
   'WeibullDistribution<ParameterValue=_ShapeScale BetaDistribution<ParameterValue=_ShapeScale GammaDistribution<ParameterValue=_ShapeScale',
   'UniformDistribution<ParameterValue=_Uniform TriangularDistribution<ParameterValue=_Triangular BinomialDistribution<ParameterValue=_Binomial',
  ].join(' '),
  simple: {TimeUnit: 'ms|s|min|hour|day|year', ResultType: 'min|max|mean|count|sum'},
  types: {
   _Data: ['', '(Scenario=Scenario)+', ''],
   Scenario: ['', '(ScenarioParameters=ScenarioParameters? ElementParameters=ElementParameters* Calendar=Calendar* VendorExtension=VendorExtension*)?',
    'id:id! name:string description:string author:string vendor:string version:string inherits:idref result:idref created:dateTime modified:dateTime'],
   ScenarioParameters: ['', `(Start${P} Duration${P} PropertyParameters=PropertyParameters?)?`, 'replication:int seed:long baseTimeUnit:TimeUnit baseCurrencyUnit:string'],
   VendorExtension: ['', '(%other.strict)?', 'name:string!', 'open-strict'],
   ElementParameters: ['', '(TimeParameters=TimeParameters? ControlParameters=ControlParameters? ResourceParameters=ResourceParameters? PriorityParameters=PriorityParameters? CostParameters=CostParameters? PropertyParameters=PropertyParameters? VendorExtension=VendorExtension*)?', 'id:id elementRef:ref'],
   TimeParameters: ['', `(TransferTime${P} QueueTime${P} WaitTime${P} SetUpTime${P} ProcessingTime${P} ValidationTime${P} ReworkTime${P})?`, ''],
   ControlParameters: ['', `(Probability${P} Condition${P} InterTriggerTimer${P} TriggerCount${P})?`, ''],
   CostParameters: ['', `(FixedCost${P} UnitCost${P})?`, ''],
   ResourceParameters: ['', `(Selection${P} Availability${P} Quantity${P} Role=Parameter*)?`, ''],
   PriorityParameters: ['', `(Interruptible${P} Priority${P})?`, ''],
   PropertyParameters: ['', '(Property=_Property*)?', ''],
   Parameter: ['', '(ResultRequest=ResultType* ParameterValue*)?', 'kpi:boolean=false sla:boolean=false'],
   _Property: ['Parameter', '', 'name:string!'],
   Calendar: ['', '=string', 'id:id name:string'],
   ParameterValue: ['', '', 'validFor:idref instance:string result:ResultType'],
   _Enum: ['ParameterValue', '(ParameterValue)+', ''],
   _Expression: ['ParameterValue', '', 'value:string'],
   ConstantParameter: ['ParameterValue', '', ''],
   _String: ['ConstantParameter', '', 'value:string'],
   _Numeric: ['ConstantParameter', '', 'value:long ' + UNITS],
   _Floating: ['ConstantParameter', '', 'value:double ' + UNITS],
   _Boolean: ['ConstantParameter', '', 'value:boolean'],
   _Duration: ['ConstantParameter', '', 'value:duration'],
   _DateTime: ['ConstantParameter', '', 'value:dateTime'],
   DistributionParameter: ['ParameterValue', '', UNITS],
   _MeanSd: ['DistributionParameter', '', 'mean:double standardDeviation:double'],
   _Truncated: ['DistributionParameter', '', 'mean:double standardDeviation:double min:double max:double'],
   _Mean: ['DistributionParameter', '', 'mean:double'],
   _Erlang: ['DistributionParameter', '', 'mean:double k:double'],
   _ShapeScale: ['DistributionParameter', '', 'shape:double scale:double'],
   _Uniform: ['DistributionParameter', '', 'min:double max:double'],
   _Triangular: ['DistributionParameter', '', 'mode:double min:double max:double'],
   _Binomial: ['DistributionParameter', '', 'probability:double trials:long'],
   _User: ['DistributionParameter', '(UserDistributionDataPoint)+', 'discrete:boolean=false'],
   _DataPoint: ['', 'ParameterValue', 'probability:float'],
  },
 };
 root.LWProcessBpmnRulesBpsim = {tables: [bpsim]};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnRulesBpsim;
})(globalThis);
