// Allow-list shaping for public news responses. Article rows carry the staff author id and
// push-notification bookkeeping; related players/teams/competitions used to be whole rows.

type Row = Record<string, unknown>;

export function toPublicNewsArticle(a: Row) {
    return {
        id: a.id,
        title: a.title,
        slug: a.slug,
        content: a.content,
        excerpt: a.excerpt,
        imageUrl: a.imageUrl,
        category: a.category,
        tags: a.tags,
        isBreaking: a.isBreaking,
        isFeatured: a.isFeatured,
        authorName: a.authorName,
        views: a.views,
        likes: a.likes,
        status: a.status,
        publishedAt: a.publishedAt,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
    };
}

// List rows for non-admin callers: the same fields without the article body.
export function toPublicNewsListItem(a: Row) {
    const { content, ...rest } = toPublicNewsArticle(a);
    void content;
    return rest;
}

export function toPublicNewsRelatedPlayer(p: Row) {
    return {
        id: p.id,
        name: p.name,
        jerseyName: p.jerseyName,
        number: p.number,
        position: p.position,
        image: p.image,
    };
}

export function toPublicNewsRelatedTeam(t: Row) {
    return {
        id: t.id,
        name: t.name,
        shortName: t.shortName,
        logo: t.logo,
    };
}

export function toPublicNewsRelatedCompetition(c: Row) {
    return {
        id: c.id,
        name: c.name,
        sport: c.sport,
        season: c.season,
        logo: c.logo,
        status: c.status,
    };
}
