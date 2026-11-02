using System.Reflection;
using System.Reflection.Emit;
using System.Reflection.Metadata;
using System.Reflection.Metadata.Ecma335;
using System.Reflection.PortableExecutable;
using System.Security.Cryptography;
using System.Text.Json;

// PEReader only: never load or execute the inspected assembly.
if(args.Length!=3)throw new ArgumentException("old.dll new.dll new-output.json");
var old=Read(args[0]);var updated=Read(args[1]);
var added=updated.Definitions.Keys.Except(old.Definitions.Keys).Order().ToArray();
var removed=old.Definitions.Keys.Except(updated.Definitions.Keys).Order().ToArray();
var changed=old.Definitions.Keys.Intersect(updated.Definitions.Keys).Where(k=>old.Definitions[k]!=updated.Definitions[k]).Order().ToArray();
var bodies=old.Bodies.Keys.Intersect(updated.Bodies.Keys).Where(k=>old.Bodies[k]!=updated.Bodies[k]).Order().ToArray();
var report=new{oldIdentity=old.Identity,newIdentity=updated.Identity,oldEntry=old.Entry,newEntry=updated.Entry,
    referencesEqual=old.References.SequenceEqual(updated.References),oldReferences=old.References,newReferences=updated.References,
    oldMachine=old.Machine,newMachine=updated.Machine,oldMembers=old.Definitions.Count,newMembers=updated.Definitions.Count,
    added,removed,changed,bodies,oldDefinitions=old.Definitions,newDefinitions=updated.Definitions,
    oldBodies=old.Bodies,newBodies=updated.Bodies};
using(var stream=new FileStream(args[2],FileMode.CreateNew))await JsonSerializer.SerializeAsync(stream,report,new JsonSerializerOptions{WriteIndented=true});
Console.WriteLine(JsonSerializer.Serialize(new{added=added.Length,removed=removed.Length,changed=changed.Length,bodies=bodies.Length,referencesEqual=report.referencesEqual}));

static Image Read(string path) {
    using var stream=File.OpenRead(path);using var pe=new PEReader(stream);
    var reader=pe.GetMetadataReader();var provider=new Names(reader);
    var definitions=new SortedDictionary<string,string>(StringComparer.Ordinal);
    var bodies=new SortedDictionary<string,string>(StringComparer.Ordinal);
    foreach(var th in reader.TypeDefinitions){
        var t=reader.GetTypeDefinition(th);var name=provider.Type(th);
        definitions.Add("T:"+name,t.Attributes+":"+provider.Entity(t.BaseType)+":"+string.Join(",",t.GetInterfaceImplementations().Select(i=>provider.Entity(reader.GetInterfaceImplementation(i).Interface)).Order()));
        foreach(var fh in t.GetFields()){
            var f=reader.GetFieldDefinition(fh);
            definitions.Add("F:"+name+"::"+reader.GetString(f.Name),f.Attributes+":"+f.DecodeSignature(provider,null)+":"+provider.Constant(f.GetDefaultValue()));
        }
        foreach(var ph in t.GetProperties()){
            var property=reader.GetPropertyDefinition(ph);
            definitions.Add("P:"+name+"::"+reader.GetString(property.Name),property.Attributes+":"+Names.Signature(property.DecodeSignature(provider,null)));
        }
        foreach(var mh in t.GetMethods()){
            var m=reader.GetMethodDefinition(mh);var key="M:"+provider.Method(mh);
            var parameters=m.GetParameters().Select(h=>{var p=reader.GetParameter(h);return p.SequenceNumber+":"+p.Attributes+":"+provider.Constant(p.GetDefaultValue());});
            definitions.Add(key,m.Attributes+":"+m.ImplAttributes+":"+string.Join(";",parameters));
            if(m.RelativeVirtualAddress==0)continue;
            var b=pe.GetMethodBody(m.RelativeVirtualAddress);
            var locals=b.LocalSignature.IsNil?"":string.Join(",",reader.GetStandaloneSignature(b.LocalSignature).DecodeLocalSignature(provider,null));
            var regions=b.ExceptionRegions.Select(e=>new{kind=e.Kind.ToString(),e.TryOffset,e.TryLength,e.HandlerOffset,e.HandlerLength,e.FilterOffset,catchType=provider.Entity(e.CatchType)});
            var canonical=JsonSerializer.Serialize(new{b.MaxStack,b.LocalVariablesInitialized,locals,regions,il=IL(b.GetILBytes()??[],provider)});
            bodies.Add(key,Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(canonical))));
        }
    }
    var assembly=reader.GetAssemblyDefinition();var entry=pe.PEHeaders.CorHeader!.EntryPointTokenOrRelativeVirtualAddress;
    return new(reader.GetString(assembly.Name)+","+assembly.Version+","+Convert.ToHexString(reader.GetBlobBytes(assembly.PublicKey)),
        reader.AssemblyReferences.Select(h=>{var a=reader.GetAssemblyReference(h);return reader.GetString(a.Name)+","+a.Version+","+Convert.ToHexString(reader.GetBlobBytes(a.PublicKeyOrToken));}).Order().ToArray(),
        pe.PEHeaders.CoffHeader.Machine.ToString(),provider.Entity(MetadataTokens.EntityHandle(entry)),definitions,bodies);
}

static string[] IL(byte[] data,Names names){
    var opcodes=typeof(OpCodes).GetFields(BindingFlags.Public|BindingFlags.Static).Where(f=>f.FieldType==typeof(OpCode)).Select(f=>(OpCode)f.GetValue(null)!).ToDictionary(o=>unchecked((ushort)o.Value));
    var instructions=new List<string>();int i=0;
    while(i<data.Length){
        ushort code=data[i++];if(code==0xfe)code=(ushort)(0xfe00|data[i++]);var op=opcodes[code];string arg="";
        int I4(){int n=BitConverter.ToInt32(data,i);i+=4;return n;}
        switch(op.OperandType){
            case OperandType.InlineNone:break;
            case OperandType.ShortInlineI:arg=unchecked((sbyte)data[i++]).ToString();break;
            case OperandType.ShortInlineVar:arg=data[i++].ToString();break;
            case OperandType.InlineVar:arg=BitConverter.ToUInt16(data,i).ToString();i+=2;break;
            case OperandType.ShortInlineBrTarget:arg=unchecked((sbyte)data[i++]).ToString();break;
            case OperandType.InlineBrTarget:case OperandType.InlineI:arg=I4().ToString();break;
            case OperandType.InlineI8:arg=BitConverter.ToInt64(data,i).ToString();i+=8;break;
            case OperandType.ShortInlineR:arg=Convert.ToHexString(data.AsSpan(i,4));i+=4;break;
            case OperandType.InlineR:arg=Convert.ToHexString(data.AsSpan(i,8));i+=8;break;
            case OperandType.InlineSwitch:var count=I4();arg=string.Join(",",Enumerable.Range(0,count).Select(_=>I4()));break;
            case OperandType.InlineString:arg=names.UserString(I4());break;
            case OperandType.InlineField:case OperandType.InlineMethod:case OperandType.InlineType:case OperandType.InlineTok:case OperandType.InlineSig:arg=names.Entity(MetadataTokens.EntityHandle(I4()));break;
            default:throw new InvalidDataException("Unknown IL operand "+op.OperandType);
        }
        instructions.Add(op.Name+" "+arg);
    }
    return [..instructions];
}

sealed record Image(string Identity,string[] References,string Machine,string Entry,SortedDictionary<string,string> Definitions,SortedDictionary<string,string> Bodies);
sealed class Names(MetadataReader reader):ISignatureTypeProvider<string,object?> {
    public string Type(TypeDefinitionHandle h){if(h.IsNil)return "nil";var t=reader.GetTypeDefinition(h);var parent=t.GetDeclaringType();return parent.IsNil?Join(reader.GetString(t.Namespace),reader.GetString(t.Name)):Type(parent)+"+"+reader.GetString(t.Name);}
    static string Join(string ns,string name)=>ns.Length==0?name:ns+"."+name;
    public string Method(MethodDefinitionHandle h){var m=reader.GetMethodDefinition(h);return Type(m.GetDeclaringType())+"::"+reader.GetString(m.Name)+":"+Signature(m.DecodeSignature(this,null));}
    public static string Signature(MethodSignature<string> s)=>$"{s.Header.RawValue:X2}/{s.GenericParameterCount}/{s.RequiredParameterCount}:{s.ReturnType}({string.Join(",",s.ParameterTypes)})";
    public string Constant(ConstantHandle h){if(h.IsNil)return "nil";var c=reader.GetConstant(h);return c.TypeCode+":"+Convert.ToHexString(reader.GetBlobBytes(c.Value));}
    public string UserString(int token)=>JsonSerializer.Serialize(reader.GetUserString(MetadataTokens.UserStringHandle(token&0xffffff)));
    public string Entity(EntityHandle h){if(h.IsNil)return "nil";return h.Kind switch{
        HandleKind.TypeDefinition=>Type((TypeDefinitionHandle)h),
        HandleKind.TypeReference=>GetTypeFromReference(reader,(TypeReferenceHandle)h,0),
        HandleKind.TypeSpecification=>GetTypeFromSpecification(reader,null,(TypeSpecificationHandle)h,0),
        HandleKind.MethodDefinition=>Method((MethodDefinitionHandle)h),
        HandleKind.FieldDefinition=>Field((FieldDefinitionHandle)h),
        HandleKind.MemberReference=>Member((MemberReferenceHandle)h),
        HandleKind.MethodSpecification=>MethodSpec((MethodSpecificationHandle)h),
        HandleKind.StandaloneSignature=>Signature(reader.GetStandaloneSignature((StandaloneSignatureHandle)h).DecodeMethodSignature(this,null)),
        HandleKind.AssemblyReference=>reader.GetString(reader.GetAssemblyReference((AssemblyReferenceHandle)h).Name),
        HandleKind.ModuleReference=>reader.GetString(reader.GetModuleReference((ModuleReferenceHandle)h).Name),
        _=>h.Kind+":"+MetadataTokens.GetToken(h).ToString("X8")};}
    string Field(FieldDefinitionHandle h){var f=reader.GetFieldDefinition(h);return Type(f.GetDeclaringType())+"::"+reader.GetString(f.Name)+":"+f.DecodeSignature(this,null);}
    string Member(MemberReferenceHandle h){var m=reader.GetMemberReference(h);return Entity(m.Parent)+"::"+reader.GetString(m.Name)+":"+(m.GetKind()==MemberReferenceKind.Method?Signature(m.DecodeMethodSignature(this,null)):m.DecodeFieldSignature(this,null));}
    string MethodSpec(MethodSpecificationHandle h){var s=reader.GetMethodSpecification(h);return Entity(s.Method)+"<"+string.Join(",",s.DecodeSignature(this,null))+">";}
    public string GetArrayType(string elementType,ArrayShape shape)=>elementType+"[rank="+shape.Rank+";sizes="+string.Join(",",shape.Sizes)+";lower="+string.Join(",",shape.LowerBounds)+"]";
    public string GetByReferenceType(string elementType)=>elementType+"&";
    public string GetFunctionPointerType(MethodSignature<string> signature)=>"fn:"+Signature(signature);
    public string GetGenericInstantiation(string genericType,System.Collections.Immutable.ImmutableArray<string> typeArguments)=>genericType+"<"+string.Join(",",typeArguments)+">";
    public string GetGenericMethodParameter(object? context,int index)=>"!!"+index;
    public string GetGenericTypeParameter(object? context,int index)=>"!"+index;
    public string GetModifiedType(string modifier,string unmodifiedType,bool isRequired)=>(isRequired?"req":"opt")+"("+modifier+")"+unmodifiedType;
    public string GetPinnedType(string elementType)=>"pinned "+elementType;
    public string GetPointerType(string elementType)=>elementType+"*";
    public string GetPrimitiveType(PrimitiveTypeCode code)=>code.ToString();
    public string GetSZArrayType(string elementType)=>elementType+"[]";
    public string GetTypeFromDefinition(MetadataReader r,TypeDefinitionHandle handle,byte rawTypeKind)=>Type(handle);
    public string GetTypeFromReference(MetadataReader r,TypeReferenceHandle handle,byte rawTypeKind){var t=r.GetTypeReference(handle);var scope=t.ResolutionScope;return scope.Kind==HandleKind.TypeReference?GetTypeFromReference(r,(TypeReferenceHandle)scope,0)+"+"+r.GetString(t.Name):"["+Entity(scope)+"]"+Join(r.GetString(t.Namespace),r.GetString(t.Name));}
    public string GetTypeFromSpecification(MetadataReader r,object? context,TypeSpecificationHandle handle,byte rawTypeKind)=>r.GetTypeSpecification(handle).DecodeSignature(this,context);
}
