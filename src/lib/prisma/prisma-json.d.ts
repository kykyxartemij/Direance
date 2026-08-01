// Maps schema.prisma `/// [TypeName]` comments to their real type. Pure indirection — never
// author a shape here, only point at where it's actually defined in models/*.ts.

export {};

declare global {
  namespace PrismaJson {
    type MappingConfig = import('@/models/mapping.models').MappingConfig;
    type ConnectionConfig = import('@/models/connection.models').ConnectionConfig;
    type HeaderLayoutModel = import('@/models/export-settings.models').HeaderLayoutModel;
    type MappedValueModels = import('@/models/export-settings.models').MappedValueModel[];
  }
}
