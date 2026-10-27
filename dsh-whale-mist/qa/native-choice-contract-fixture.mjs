// Metadata/setter stand-ins only; real combobox and action-menu lifecycle is verified by the SDK DOM suite.
export function choiceContract(type,props,...children){
 if(type?.name==='ActionMenu')return {type:'menu-command-contract',props:{...props.attributes,'data-menu-contract':props.name},children:[...(props.description?(Array.isArray(props.description)?props.description:[props.description]):[]),...(props.entries??[]).map(entry=>({type:'button',props:{...entry.attributes,disabled:entry.disabled,onClick:entry.action},children:[entry.label]}))]};
 if(type?.name==='Select')return {type:'select',props:{...props,onChange:event=>props.onChange({currentTarget:event.currentTarget,value:event.currentTarget.value})},children};
 return {type,props:props??{},children};
}
export function groupedFields(section){
 return section.children.flat(Infinity).flatMap(node=>['Group','Fold'].includes(node?.type?.name)?groupedFields(node):[node]).filter(Boolean);
}
