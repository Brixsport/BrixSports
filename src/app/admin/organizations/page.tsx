'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    ArrowLeft,
    Building2,
    FolderTree,
    Globe,
    Loader2,
    MapPin,
    Plus,
    Search,
    Shield,
    Users,
} from 'lucide-react';

type OrganizationType =
    | 'organization'
    | 'university'
    | 'college'
    | 'department'
    | 'club'
    | 'academy'
    | 'association'
    | 'student_association'
    | 'governing_body';

type OrganizationStatus = 'active' | 'inactive';

interface OrganizationRecord {
    id: string;
    name: string;
    slug: string;
    type: OrganizationType;
    shortName: string | null;
    displayName: string | null;
    parentOrganizationId: string | null;
    isInternalUnit: boolean | null;
    status: OrganizationStatus | null;
    location: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    parent?: {
        id: string;
        name: string;
        shortName: string | null;
    } | null;
    counts: {
        childOrganizations: number;
        ownedTeams: number;
        playerAffiliations: number;
    };
}

interface OrganizationFormState {
    name: string;
    type: OrganizationType;
    shortName: string;
    displayName: string;
    parentOrganizationId: string;
    location: string;
    status: OrganizationStatus;
    isInternalUnit: boolean;
}

const ORGANIZATION_TYPE_OPTIONS: Array<{ value: OrganizationType; label: string }> = [
    { value: 'university', label: 'University' },
    { value: 'student_association', label: 'Student Association' },
    { value: 'governing_body', label: 'Governing Body' },
    { value: 'college', label: 'College / Faculty' },
    { value: 'department', label: 'Department / Level' },
    { value: 'club', label: 'Club' },
    { value: 'academy', label: 'Academy' },
    { value: 'association', label: 'Association' },
    { value: 'organization', label: 'Other Organization' },
];

const INITIAL_FORM: OrganizationFormState = {
    name: '',
    type: 'organization',
    shortName: '',
    displayName: '',
    parentOrganizationId: '',
    location: '',
    status: 'active',
    isInternalUnit: false,
};

function getOrganizationLabel(organization: OrganizationRecord) {
    return organization.displayName || organization.shortName || organization.name;
}

function getTypeBadgeColor(type: OrganizationType) {
    switch (type) {
        case 'university':
            return 'bg-primary/20 text-primary border-primary/20';
        case 'student_association':
        case 'governing_body':
            return 'bg-blue-500/15 text-blue-300 border-blue-400/20';
        case 'college':
        case 'department':
            return 'bg-amber-500/15 text-amber-300 border-amber-400/20';
        case 'club':
        case 'academy':
            return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20';
        default:
            return 'bg-white/10 text-white/70 border-white/10';
    }
}

export default function AdminOrganizationsPage() {
    const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | OrganizationType>('all');
    const [form, setForm] = useState<OrganizationFormState>(INITIAL_FORM);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const loadOrganizations = async () => {
        try {
            setErrorMessage('');
            const response = await fetch('/api/admin/organizations');
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to load organizations');
            }

            setOrganizations(data.organizations || []);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to load organizations');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadOrganizations();
    }, []);

    const filteredOrganizations = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();

        return organizations.filter((organization) => {
            const matchesType = typeFilter === 'all' || organization.type === typeFilter;
            const matchesSearch = !normalizedQuery || [
                organization.name,
                organization.shortName,
                organization.displayName,
                organization.type,
                organization.location,
                organization.parent?.name,
            ].filter(Boolean).some((value) => value!.toLowerCase().includes(normalizedQuery));

            return matchesType && matchesSearch;
        });
    }, [organizations, searchQuery, typeFilter]);

    const organizationIds = new Set(filteredOrganizations.map((organization) => organization.id));
    const hierarchyRoots = useMemo(() => {
        return filteredOrganizations.filter((organization) =>
            !organization.parentOrganizationId || !organizationIds.has(organization.parentOrganizationId)
        );
    }, [filteredOrganizations, organizationIds]);

    const childrenByParentId = useMemo(() => {
        const map = new Map<string, OrganizationRecord[]>();

        for (const organization of filteredOrganizations) {
            if (!organization.parentOrganizationId) {
                continue;
            }

            const siblings = map.get(organization.parentOrganizationId) ?? [];
            siblings.push(organization);
            map.set(organization.parentOrganizationId, siblings);
        }

        for (const siblings of map.values()) {
            siblings.sort((left, right) => left.name.localeCompare(right.name));
        }

        return map;
    }, [filteredOrganizations]);

    const stats = useMemo(() => ({
        total: organizations.length,
        roots: organizations.filter((organization) => !organization.parentOrganizationId).length,
        internalUnits: organizations.filter((organization) => organization.isInternalUnit).length,
        teamOwners: organizations.filter((organization) => organization.counts.ownedTeams > 0).length,
    }), [organizations]);

    const parentOptions = useMemo(() => (
        organizations
            .slice()
            .sort((left, right) => left.name.localeCompare(right.name))
    ), [organizations]);

    const handleCreateOrganization = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSaving(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const response = await fetch('/api/admin/organizations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    parentOrganizationId: form.parentOrganizationId || null,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to create organization');
            }

            setForm(INITIAL_FORM);
            setSuccessMessage(`${data.organization?.name || 'Organization'} created successfully`);
            await loadOrganizations();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to create organization');
        } finally {
            setIsSaving(false);
        }
    };

    const renderOrganizationTree = (organization: OrganizationRecord, depth = 0): React.ReactNode => {
        const children = childrenByParentId.get(organization.id) ?? [];

        return (
            <div key={organization.id} className="space-y-3">
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className="rounded-[28px] border border-white/10 bg-white/5 p-5"
                    style={{ marginLeft: `${depth * 18}px` }}
                >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${getTypeBadgeColor(organization.type)}`}>
                                    {organization.type.replace('_', ' ')}
                                </span>
                                <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${organization.status === 'active'
                                    ? 'border-emerald-400/20 bg-emerald-500/15 text-emerald-300'
                                    : 'border-white/10 bg-white/10 text-white/50'
                                    }`}>
                                    {organization.status || 'unknown'}
                                </span>
                                {organization.isInternalUnit ? (
                                    <span className="rounded-full border border-amber-400/20 bg-amber-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
                                        Internal Unit
                                    </span>
                                ) : null}
                            </div>

                            <div>
                                <h2 className="font-display text-2xl italic uppercase tracking-tight">
                                    {getOrganizationLabel(organization)}
                                </h2>
                                <p className="text-xs font-bold uppercase tracking-widest text-white/30">
                                    {organization.name}
                                    {organization.shortName ? ` • ${organization.shortName}` : ''}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-4 text-[10px] font-black uppercase tracking-widest text-white/40">
                                <span className="flex items-center gap-2">
                                    <FolderTree size={14} className="text-primary" />
                                    {organization.counts.childOrganizations} child orgs
                                </span>
                                <span className="flex items-center gap-2">
                                    <Shield size={14} className="text-primary" />
                                    {organization.counts.ownedTeams} owned teams
                                </span>
                                <span className="flex items-center gap-2">
                                    <Users size={14} className="text-primary" />
                                    {organization.counts.playerAffiliations} player links
                                </span>
                                {organization.location ? (
                                    <span className="flex items-center gap-2">
                                        <MapPin size={14} className="text-primary" />
                                        {organization.location}
                                    </span>
                                ) : null}
                            </div>
                        </div>

                        <div className="space-y-2 text-right">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Parent</p>
                            <p className="text-sm font-bold uppercase tracking-tight text-white/70">
                                {organization.parent?.shortName || organization.parent?.name || 'Root Organization'}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {children.length > 0 ? (
                    <div className="space-y-3">
                        {children.map((child) => renderOrganizationTree(child, depth + 1))}
                    </div>
                ) : null}
            </div>
        );
    };

    return (
        <div className="p-4 md:p-6 lg:p-10">
            <div className="mx-auto max-w-7xl space-y-8">
                <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-3">
                        <Link
                            href="/admin"
                            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 transition-colors hover:text-white"
                        >
                            <ArrowLeft size={14} />
                            Back To Admin
                        </Link>
                        <div>
                            <h1 className="font-display text-3xl italic uppercase tracking-tight md:text-5xl">
                                Organizations
                            </h1>
                            <p className="max-w-2xl text-sm text-white/50">
                                Manage the ownership layer behind universities, colleges, departments, associations, and governing bodies.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <StatCard label="Total" value={stats.total} icon={<Globe size={18} />} />
                        <StatCard label="Roots" value={stats.roots} icon={<Building2 size={18} />} />
                        <StatCard label="Internal Units" value={stats.internalUnits} icon={<FolderTree size={18} />} />
                        <StatCard label="Team Owners" value={stats.teamOwners} icon={<Shield size={18} />} />
                    </div>
                </header>

                <section className="grid gap-6 xl:grid-cols-[1.5fr,0.9fr]">
                    <div className="space-y-6">
                        <div className="flex flex-col gap-3 rounded-[32px] border border-white/10 bg-white/5 p-5 md:flex-row md:items-center md:justify-between">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" size={16} />
                                <input
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder="Search organizations, parent units, location..."
                                    className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm font-bold outline-none transition-colors focus:border-primary"
                                />
                            </div>

                            <select
                                value={typeFilter}
                                onChange={(event) => setTypeFilter(event.target.value as 'all' | OrganizationType)}
                                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold outline-none transition-colors focus:border-primary"
                            >
                                <option value="all">All Types</option>
                                {ORGANIZATION_TYPE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="rounded-[32px] border border-white/10 bg-white/5 p-5 md:p-6">
                            <div className="mb-5 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Hierarchy</p>
                                    <h2 className="font-display text-2xl italic uppercase tracking-tight">
                                        {filteredOrganizations.length} visible organizations
                                    </h2>
                                </div>
                            </div>

                            {isLoading ? (
                                <div className="flex items-center justify-center py-20 text-white/40">
                                    <Loader2 size={24} className="animate-spin" />
                                </div>
                            ) : hierarchyRoots.length === 0 ? (
                                <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 p-10 text-center text-sm text-white/40">
                                    No organizations match this filter yet.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {hierarchyRoots
                                        .sort((left, right) => left.name.localeCompare(right.name))
                                        .map((organization) => renderOrganizationTree(organization))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-[32px] border border-white/10 bg-white/5 p-5 md:p-6">
                        <div className="mb-5 flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-black">
                                <Plus size={18} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Create Organization</p>
                                <h2 className="font-display text-2xl italic uppercase tracking-tight">New Node</h2>
                            </div>
                        </div>

                        <form onSubmit={handleCreateOrganization} className="space-y-4">
                            <Field label="Name">
                                <input
                                    value={form.name}
                                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                                    placeholder="Bells University"
                                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold outline-none transition-colors focus:border-primary"
                                    required
                                />
                            </Field>

                            <div className="grid gap-4 md:grid-cols-2">
                                <Field label="Type">
                                    <select
                                        value={form.type}
                                        onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as OrganizationType }))}
                                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold outline-none transition-colors focus:border-primary"
                                    >
                                        {ORGANIZATION_TYPE_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </Field>

                                <Field label="Status">
                                    <select
                                        value={form.status}
                                        onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as OrganizationStatus }))}
                                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold outline-none transition-colors focus:border-primary"
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </Field>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <Field label="Short Name">
                                    <input
                                        value={form.shortName}
                                        onChange={(event) => setForm((current) => ({ ...current, shortName: event.target.value }))}
                                        placeholder="BUSA"
                                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold outline-none transition-colors focus:border-primary"
                                    />
                                </Field>

                                <Field label="Display Name">
                                    <input
                                        value={form.displayName}
                                        onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                                        placeholder="Bells University Student Association"
                                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold outline-none transition-colors focus:border-primary"
                                    />
                                </Field>
                            </div>

                            <Field label="Parent Organization">
                                <select
                                    value={form.parentOrganizationId}
                                    onChange={(event) => setForm((current) => ({ ...current, parentOrganizationId: event.target.value }))}
                                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold outline-none transition-colors focus:border-primary"
                                >
                                    <option value="">No parent (root organization)</option>
                                    {parentOptions.map((organization) => (
                                        <option key={organization.id} value={organization.id}>
                                            {organization.name} ({organization.type.replace('_', ' ')})
                                        </option>
                                    ))}
                                </select>
                            </Field>

                            <Field label="Location">
                                <input
                                    value={form.location}
                                    onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                                    placeholder="Ota, Ogun State"
                                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold outline-none transition-colors focus:border-primary"
                                />
                            </Field>

                            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                <input
                                    type="checkbox"
                                    checked={form.isInternalUnit}
                                    onChange={(event) => setForm((current) => ({ ...current, isInternalUnit: event.target.checked }))}
                                    className="h-4 w-4 rounded border-white/20 bg-transparent text-primary"
                                />
                                <div>
                                    <p className="text-sm font-bold uppercase tracking-tight">Internal Unit</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/30">
                                        Use for colleges, departments, or subordinate campus structures
                                    </p>
                                </div>
                            </label>

                            {errorMessage ? (
                                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                    {errorMessage}
                                </div>
                            ) : null}

                            {successMessage ? (
                                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                                    {successMessage}
                                </div>
                            ) : null}

                            <button
                                type="submit"
                                disabled={isSaving}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black uppercase tracking-widest text-black transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                Create Organization
                            </button>
                        </form>
                    </div>
                </section>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
    return (
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
            <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/30">{label}</span>
                <span className="text-primary">{icon}</span>
            </div>
            <p className="font-display text-3xl italic">{value}</p>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/35">{label}</span>
            {children}
        </label>
    );
}
