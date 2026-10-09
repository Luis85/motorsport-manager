/// <reference path="./process-contracts.d.ts" />
/**
 * Conformance rules for BPMN 2.0 interchange files: the semantic MODEL namespace and the diagram namespaces (BPMN DI, OMG DD
 * DI and DC), written as Wildlands data in the compact notation below. They restate the structure the OMG BPMN 2.0 XML
 * Schemas define (element names, nesting order, occurrences, attribute types and defaults) without shipping or reading any
 * schema file; `LWProcessBpmnConformance` compiles and applies them.
 *
 * Notation of one table (one namespace):
 * - `elements`: the top-level elements, space separated. `name` has the type `typePrefix` + Name (`task` -> `tTask`),
 *   `name=type` names another type, `<head` puts the element in the substitution group of `head` (it may stand wherever
 *   `head` is allowed), a leading `~` marks an element that is recognised but not covered (reported, never checked) and a
 *   leading `!` an abstract element (only members of its group may appear).
 * - `types`: `[base, content, attributes, flags]`. A derived type's content follows its base's content in order and adds
 *   to its attributes. Content is a sequence of particles: `name` is a top-level element (`p:name` from another table),
 *   `name=type` a local element of that type (lower-case types are simple values); suffixes `?`, `*`, `+` and `{m,n}` give
 *   occurrences; `( a b )` groups a sequence and `( a | b )` a choice; `%other.lax`, `%other.strict` and `%any.lax` accept
 *   elements of another namespace or of any namespace, checked when declared (lax) or required to be declared (strict).
 *   Content `=type` is a text value of that simple type. Attributes are `name:type`, `!` when required, `=value` for the
 *   default. Flags: `abstract` (only a derived type may be used), `mixed` (text between children), `open` (attributes of
 *   other namespaces allowed) and `open-strict` (allowed only when declared).
 * - `simple`: named value types; `a|b|c` is an enumeration and `uri+a|b` a URI or one of the listed tokens.
 * Simple types: string, boolean, integer, int, long, double, float, id, idref (must name an id in the file), qname, ref (a
 * qualified name that must name an element of this file unless its prefix points at another namespace), uri, dateTime and duration.
 */
declare namespace LWProcessBpmnRules {
 interface Table {ns: string; prefix: string; typePrefix: string; elements: string; types: Record<string, [string, string, string, string?]>; simple?: Record<string, string>}
 interface Api {tables: Table[]}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessBpmnRulesModel?: LWProcessBpmnRules.Api};
 const MODEL = 'http://www.omg.org/spec/BPMN/20100524/MODEL', BPMNDI = 'http://www.omg.org/spec/BPMN/20100524/DI', DI = 'http://www.omg.org/spec/DD/20100524/DI', DC = 'http://www.omg.org/spec/DD/20100524/DC';
 // Event, activity and gateway types share these groups of children.
 const CATCH = 'dataOutput* dataOutputAssociation* outputSet? eventDefinition* eventDefinitionRef=ref*', THROW = 'dataInput* dataInputAssociation* inputSet? eventDefinition* eventDefinitionRef=ref*';
 const model: LWProcessBpmnRules.Table = {ns: MODEL, prefix: 'bpmn', typePrefix: 't',
  elements: [
   'definitions import extension extensionElements documentation relationship rootElement !gateway',
   'process<rootElement collaboration<rootElement message<rootElement signal<rootElement error<rootElement escalation<rootElement itemDefinition<rootElement',
   'resource<rootElement dataStore<rootElement category<rootElement interface<rootElement endPoint<rootElement eventDefinition<rootElement callableElement',
   'globalTask<rootElement globalUserTask<rootElement globalManualTask<rootElement globalScriptTask<rootElement globalBusinessRuleTask<rootElement',
   'flowElement flowNode activity catchEvent throwEvent baseElement baseElementWithMixedContent artifact auditing monitoring rendering',
   'task<flowElement userTask<flowElement manualTask<flowElement serviceTask<flowElement sendTask<flowElement receiveTask<flowElement scriptTask<flowElement',
   'businessRuleTask<flowElement subProcess<flowElement adHocSubProcess<flowElement transaction<flowElement callActivity<flowElement script',
   'startEvent<flowElement endEvent<flowElement intermediateCatchEvent<flowElement intermediateThrowEvent<flowElement boundaryEvent<flowElement',
   'implicitThrowEvent<flowElement event<flowElement exclusiveGateway<flowElement inclusiveGateway<flowElement parallelGateway<flowElement',
   'eventBasedGateway<flowElement complexGateway<flowElement sequenceFlow<flowElement dataObject<flowElement dataObjectReference<flowElement dataStoreReference<flowElement',
   'timerEventDefinition<eventDefinition conditionalEventDefinition<eventDefinition messageEventDefinition<eventDefinition signalEventDefinition<eventDefinition',
   'errorEventDefinition<eventDefinition escalationEventDefinition<eventDefinition linkEventDefinition<eventDefinition terminateEventDefinition<eventDefinition',
   'cancelEventDefinition<eventDefinition compensateEventDefinition<eventDefinition loopCharacteristics standardLoopCharacteristics<loopCharacteristics',
   'multiInstanceLoopCharacteristics<loopCharacteristics complexBehaviorDefinition expression formalExpression<expression laneSet lane',
   'participant participantMultiplicity messageFlow association<artifact group<artifact textAnnotation<artifact text categoryValue',
   'resourceRole performer<resourceRole humanPerformer<performer potentialOwner<performer resourceParameter resourceParameterBinding resourceAssignmentExpression',
   'property dataState dataInput dataOutput inputSet outputSet ioSpecification=tInputOutputSpecification ioBinding=tInputOutputBinding',
   'dataAssociation dataInputAssociation dataOutputAssociation assignment operation',
   // Choreography, conversation, correlation and partner elements are recognised in their places but not covered.
   '~choreography<collaboration ~globalChoreographyTask<choreography ~globalConversation<collaboration ~choreographyTask<flowElement ~callChoreography<flowElement',
   '~subChoreography<flowElement ~choreographyActivity ~conversationNode ~conversation<conversationNode ~subConversation<conversationNode ~callConversation<conversationNode',
   '~conversationLink ~conversationAssociation ~participantAssociation ~messageFlowAssociation ~correlationKey ~correlationProperty<rootElement',
   '~correlationPropertyBinding ~correlationPropertyRetrievalExpression ~correlationSubscription ~partnerEntity<rootElement ~partnerRole<rootElement',
  ].join(' '),
  simple: {
   GatewayDirection: 'Unspecified|Converging|Diverging|Mixed', ProcessType: 'None|Public|Private', AdHocOrdering: 'Parallel|Sequential', AssociationDirection: 'None|One|Both',
   EventBasedGatewayType: 'Exclusive|Parallel', ItemKind: 'Information|Physical', MultiInstanceFlowCondition: 'None|One|All|Complex', RelationshipDirection: 'None|Forward|Backward|Both',
   Implementation: 'uri+##unspecified|##WebService', TransactionMethod: 'uri+##Compensate|##Image|##Store',
  },
  types: {
   // Foundation: every BPMN element below carries an optional id, documentation and one extensionElements block.
   tDefinitions: ['', 'import* extension* rootElement* bpmndi:BPMNDiagram* relationship*', 'id:id name:string targetNamespace:uri! expressionLanguage:uri=http://www.w3.org/1999/XPath typeLanguage:uri=http://www.w3.org/2001/XMLSchema exporter:string exporterVersion:string', 'open'],
   tImport: ['', '', 'namespace:uri! location:string! importType:uri!'],
   tExtension: ['', 'documentation*', 'definition:qname mustUnderstand:boolean=false'],
   tBaseElement: ['', 'documentation* extensionElements?', 'id:id', 'abstract open'],
   tBaseElementWithMixedContent: ['', 'documentation* extensionElements?', 'id:id', 'abstract mixed open'],
   tDocumentation: ['', '%any.lax?', 'id:id textFormat:string=text/plain', 'mixed'],
   tExtensionElements: ['', '%other.lax*', ''],
   tRootElement: ['tBaseElement', '', '', 'abstract'],
   tRelationship: ['tBaseElement', 'source=ref+ target=ref+', 'type:string! direction:RelationshipDirection'],
   tExpression: ['tBaseElementWithMixedContent', '', ''],
   tFormalExpression: ['tExpression', '', 'language:uri evaluatesToTypeRef:qname'],
   tAuditing: ['tBaseElement', '', ''], tMonitoring: ['tBaseElement', '', ''], tRendering: ['tBaseElement', '', ''],
   // Processes, lanes and the flow elements they hold.
   tCallableElement: ['tRootElement', 'supportedInterfaceRef=qname* ioSpecification? ioBinding*', 'name:string'],
   tProcess: ['tCallableElement', 'auditing? monitoring? property* laneSet* flowElement* artifact* resourceRole* correlationSubscription* supports=ref*', 'processType:ProcessType=None isClosed:boolean=false isExecutable:boolean definitionalCollaborationRef:ref'],
   tLaneSet: ['tBaseElement', 'lane*', 'name:string'],
   tLane: ['tBaseElement', 'partitionElement=tBaseElement? flowNodeRef=idref* childLaneSet=tLaneSet?', 'name:string partitionElementRef:qname'],
   tFlowElement: ['tBaseElement', 'auditing? monitoring? categoryValueRef=ref*', 'name:string', 'abstract'],
   tFlowNode: ['tFlowElement', 'incoming=ref* outgoing=ref*', '', 'abstract'],
   tSequenceFlow: ['tFlowElement', 'conditionExpression=tExpression?', 'sourceRef:idref! targetRef:idref! isImmediate:boolean'],
   // Activities: tasks, sub-processes and call activities.
   tActivity: ['tFlowNode', 'ioSpecification? property* dataInputAssociation* dataOutputAssociation* resourceRole* loopCharacteristics?', 'isForCompensation:boolean=false startQuantity:integer=1 completionQuantity:integer=1 default:idref', 'abstract'],
   tTask: ['tActivity', '', ''], tManualTask: ['tTask', '', ''],
   tUserTask: ['tTask', 'rendering*', 'implementation:Implementation=##unspecified'],
   tServiceTask: ['tTask', '', 'implementation:Implementation=##WebService operationRef:ref'],
   tSendTask: ['tTask', '', 'implementation:Implementation=##WebService messageRef:ref operationRef:ref'],
   tReceiveTask: ['tTask', '', 'implementation:Implementation=##WebService instantiate:boolean=false messageRef:ref operationRef:ref'],
   tScriptTask: ['tTask', 'script?', 'scriptFormat:string'],
   tScript: ['', '%any.lax?', '', 'mixed'],
   tBusinessRuleTask: ['tTask', '', 'implementation:Implementation=##unspecified'],
   tSubProcess: ['tActivity', 'laneSet* flowElement* artifact*', 'triggeredByEvent:boolean=false'],
   tAdHocSubProcess: ['tSubProcess', 'completionCondition=tExpression?', 'cancelRemainingInstances:boolean=true ordering:AdHocOrdering'],
   tTransaction: ['tSubProcess', '', 'method:TransactionMethod=##Compensate'],
   tCallActivity: ['tActivity', '', 'calledElement:qname'],
   tLoopCharacteristics: ['tBaseElement', '', '', 'abstract'],
   tStandardLoopCharacteristics: ['tLoopCharacteristics', 'loopCondition=tExpression?', 'testBefore:boolean=false loopMaximum:integer'],
   tMultiInstanceLoopCharacteristics: ['tLoopCharacteristics', 'loopCardinality=tExpression? loopDataInputRef=ref? loopDataOutputRef=ref? inputDataItem=tDataInput? outputDataItem=tDataOutput? complexBehaviorDefinition* completionCondition=tExpression?',
    'isSequential:boolean=false behavior:MultiInstanceFlowCondition=All oneBehaviorEventRef:ref noneBehaviorEventRef:ref'],
   tComplexBehaviorDefinition: ['tBaseElement', 'condition=tFormalExpression event=tImplicitThrowEvent?', ''],
   tGlobalTask: ['tCallableElement', 'resourceRole*', ''], tGlobalManualTask: ['tGlobalTask', '', ''],
   tGlobalUserTask: ['tGlobalTask', 'rendering*', 'implementation:Implementation=##unspecified'],
   tGlobalScriptTask: ['tGlobalTask', 'script?', 'scriptLanguage:uri'],
   tGlobalBusinessRuleTask: ['tGlobalTask', '', 'implementation:Implementation=##unspecified'],
   // Events and event definitions.
   tEvent: ['tFlowNode', 'property*', '', 'abstract'],
   tCatchEvent: ['tEvent', CATCH, 'parallelMultiple:boolean=false', 'abstract'],
   tThrowEvent: ['tEvent', THROW, '', 'abstract'],
   tStartEvent: ['tCatchEvent', '', 'isInterrupting:boolean=true'],
   tIntermediateCatchEvent: ['tCatchEvent', '', ''],
   tBoundaryEvent: ['tCatchEvent', '', 'cancelActivity:boolean=true attachedToRef:ref!'],
   tEndEvent: ['tThrowEvent', '', ''], tIntermediateThrowEvent: ['tThrowEvent', '', ''], tImplicitThrowEvent: ['tThrowEvent', '', ''],
   tEventDefinition: ['tRootElement', '', '', 'abstract'],
   tTimerEventDefinition: ['tEventDefinition', '(timeDate=tExpression? | timeDuration=tExpression? | timeCycle=tExpression?)', ''],
   tConditionalEventDefinition: ['tEventDefinition', 'condition=tExpression', ''],
   tMessageEventDefinition: ['tEventDefinition', 'operationRef=ref?', 'messageRef:ref'],
   tSignalEventDefinition: ['tEventDefinition', '', 'signalRef:ref'],
   tErrorEventDefinition: ['tEventDefinition', '', 'errorRef:ref'],
   tEscalationEventDefinition: ['tEventDefinition', '', 'escalationRef:ref'],
   tLinkEventDefinition: ['tEventDefinition', 'source=ref* target=ref?', 'name:string!'],
   tTerminateEventDefinition: ['tEventDefinition', '', ''], tCancelEventDefinition: ['tEventDefinition', '', ''],
   tCompensateEventDefinition: ['tEventDefinition', '', 'waitForCompletion:boolean activityRef:ref'],
   // Gateways.
   tGateway: ['tFlowNode', '', 'gatewayDirection:GatewayDirection=Unspecified'],
   tExclusiveGateway: ['tGateway', '', 'default:idref'], tInclusiveGateway: ['tGateway', '', 'default:idref'], tParallelGateway: ['tGateway', '', ''],
   tEventBasedGateway: ['tGateway', '', 'instantiate:boolean=false eventGatewayType:EventBasedGatewayType=Exclusive'],
   tComplexGateway: ['tGateway', 'activationCondition=tExpression?', 'default:idref'],
   // Data.
   tItemDefinition: ['tRootElement', '', 'structureRef:qname isCollection:boolean=false itemKind:ItemKind=Information'],
   tDataState: ['tBaseElement', '', 'name:string'],
   tProperty: ['tBaseElement', 'dataState?', 'name:string itemSubjectRef:qname'],
   tDataObject: ['tFlowElement', 'dataState?', 'itemSubjectRef:qname isCollection:boolean=false'],
   tDataObjectReference: ['tFlowElement', 'dataState?', 'itemSubjectRef:qname dataObjectRef:idref'],
   tDataStore: ['tRootElement', 'dataState?', 'name:string capacity:integer isUnlimited:boolean=true itemSubjectRef:qname'],
   tDataStoreReference: ['tFlowElement', 'dataState?', 'itemSubjectRef:qname dataStoreRef:ref'],
   tDataInput: ['tBaseElement', 'dataState?', 'name:string itemSubjectRef:qname isCollection:boolean=false'],
   tDataOutput: ['tBaseElement', 'dataState?', 'name:string itemSubjectRef:qname isCollection:boolean=false'],
   tInputSet: ['tBaseElement', 'dataInputRefs=idref* optionalInputRefs=idref* whileExecutingInputRefs=idref* outputSetRefs=idref*', 'name:string'],
   tOutputSet: ['tBaseElement', 'dataOutputRefs=idref* optionalOutputRefs=idref* whileExecutingOutputRefs=idref* inputSetRefs=idref*', 'name:string'],
   tInputOutputSpecification: ['tBaseElement', 'dataInput* dataOutput* inputSet+ outputSet+', ''],
   tInputOutputBinding: ['tBaseElement', '', 'operationRef:ref! inputDataRef:idref! outputDataRef:idref!'],
   tDataAssociation: ['tBaseElement', 'sourceRef=idref* targetRef=idref transformation=tFormalExpression? assignment*', ''],
   tDataInputAssociation: ['tDataAssociation', '', ''], tDataOutputAssociation: ['tDataAssociation', '', ''],
   tAssignment: ['tBaseElement', 'from=tExpression to=tExpression', ''],
   // Messages, signals, errors, escalations, interfaces and resources.
   tMessage: ['tRootElement', '', 'name:string itemRef:qname'],
   tSignal: ['tRootElement', '', 'name:string structureRef:qname'],
   tError: ['tRootElement', '', 'name:string errorCode:string structureRef:qname'],
   tEscalation: ['tRootElement', '', 'name:string escalationCode:string structureRef:qname'],
   tInterface: ['tRootElement', 'operation+', 'name:string! implementationRef:qname'],
   tOperation: ['tBaseElement', 'inMessageRef=ref outMessageRef=ref? errorRef=ref*', 'name:string! implementationRef:qname'],
   tEndPoint: ['tRootElement', '', ''],
   tResource: ['tRootElement', 'resourceParameter*', 'name:string!'],
   tResourceParameter: ['tBaseElement', '', 'name:string type:qname isRequired:boolean'],
   tResourceRole: ['tBaseElement', '((resourceRef=ref resourceParameterBinding*) | resourceAssignmentExpression?)', 'name:string'],
   tPerformer: ['tResourceRole', '', ''], tHumanPerformer: ['tPerformer', '', ''], tPotentialOwner: ['tHumanPerformer', '', ''],
   tResourceParameterBinding: ['tBaseElement', 'expression', 'parameterRef:ref!'],
   tResourceAssignmentExpression: ['tBaseElement', 'expression', ''],
   // Collaboration and artifacts.
   tCollaboration: ['tRootElement', 'participant* messageFlow* artifact* conversationNode* conversationAssociation* participantAssociation* messageFlowAssociation* correlationKey* choreographyRef=ref* conversationLink*', 'name:string isClosed:boolean=false'],
   tParticipant: ['tBaseElement', 'interfaceRef=ref* endPointRef=ref* participantMultiplicity?', 'name:string processRef:ref'],
   tParticipantMultiplicity: ['tBaseElement', '', 'minimum:int=0 maximum:int=1'],
   tMessageFlow: ['tBaseElement', '', 'name:string sourceRef:ref! targetRef:ref! messageRef:ref'],
   tArtifact: ['tBaseElement', '', '', 'abstract'],
   tAssociation: ['tArtifact', '', 'sourceRef:ref! targetRef:ref! associationDirection:AssociationDirection=None'],
   tGroup: ['tArtifact', '', 'categoryValueRef:ref'],
   tTextAnnotation: ['tArtifact', 'text?', 'textFormat:string=text/plain'],
   tText: ['', '%any.lax?', '', 'mixed'],
   tCategory: ['tRootElement', 'categoryValue*', 'name:string'],
   tCategoryValue: ['tBaseElement', '', 'value:string'],
  },
 };
 // Diagram interchange: the BPMN diagram elements and the OMG diagram definition base types they extend.
 const bpmndi: LWProcessBpmnRules.Table = {ns: BPMNDI, prefix: 'bpmndi', typePrefix: '',
  elements: 'BPMNDiagram BPMNPlane BPMNLabelStyle BPMNShape<di:DiagramElement BPMNLabel BPMNEdge<di:DiagramElement',
  simple: {ParticipantBandKind: 'top_initiating|middle_initiating|bottom_initiating|top_non_initiating|middle_non_initiating|bottom_non_initiating', MessageVisibleKind: 'initiating|non_initiating'},
  types: {
   BPMNDiagram: ['di:Diagram', 'BPMNPlane BPMNLabelStyle*', ''],
   BPMNPlane: ['di:Plane', '', 'bpmnElement:ref'],
   BPMNShape: ['di:LabeledShape', 'BPMNLabel?', 'bpmnElement:ref isHorizontal:boolean isExpanded:boolean isMarkerVisible:boolean isMessageVisible:boolean participantBandKind:ParticipantBandKind choreographyActivityShape:ref'],
   BPMNEdge: ['di:LabeledEdge', 'BPMNLabel?', 'bpmnElement:ref sourceElement:ref targetElement:ref messageVisibleKind:MessageVisibleKind'],
   BPMNLabel: ['di:Label', '', 'labelStyle:ref'],
   BPMNLabelStyle: ['di:Style', 'dc:Font', ''],
  },
 };
 const di: LWProcessBpmnRules.Table = {ns: DI, prefix: 'di', typePrefix: '',
  elements: 'DiagramElement Diagram Style Node Edge Shape Plane LabeledEdge Label LabeledShape',
  types: {
   DiagramElement: ['', 'extension=_Extension?', 'id:id', 'abstract open'],
   _Extension: ['', '%other.strict*', ''],
   Diagram: ['', '', 'name:string documentation:string resolution:double id:id', 'abstract'],
   Node: ['DiagramElement', '', '', 'abstract'], Edge: ['DiagramElement', 'waypoint=dc:Point{2,}', '', 'abstract'], LabeledEdge: ['Edge', '', '', 'abstract'],
   Shape: ['Node', 'dc:Bounds', '', 'abstract'], LabeledShape: ['Shape', '', '', 'abstract'], Label: ['Node', 'dc:Bounds?', '', 'abstract'],
   Plane: ['Node', 'DiagramElement*', '', 'abstract'], Style: ['', '', 'id:id', 'abstract'],
  },
 };
 const dc: LWProcessBpmnRules.Table = {ns: DC, prefix: 'dc', typePrefix: '',
  elements: 'Font Point Bounds',
  types: {
   Font: ['', '', 'name:string size:double isBold:boolean isItalic:boolean isUnderline:boolean isStrikeThrough:boolean'],
   Point: ['', '', 'x:double! y:double!'],
   Bounds: ['', '', 'x:double! y:double! width:double! height:double!'],
  },
 };
 root.LWProcessBpmnRulesModel = {tables: [model, bpmndi, di, dc]};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnRulesModel;
})(globalThis);
