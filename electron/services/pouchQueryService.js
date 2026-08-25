const DEFAULT_PAGE_SIZE = 500;

async function findAll(db, query = {}, pageSize = DEFAULT_PAGE_SIZE) {
  const initialSkip = query.skip || 0;
  const initialBookmark = query.bookmark;
  const baseQuery = { ...query };
  delete baseQuery.limit;
  delete baseQuery.skip;
  delete baseQuery.bookmark;
  const docs = [];
  let bookmark = initialBookmark;
  let skip = initialSkip;
  let lastResult = {};

  do {
    lastResult = await db.find({
      ...baseQuery,
      limit: pageSize,
      ...(bookmark ? { bookmark } : { skip }),
    });

    const page = lastResult.docs || [];
    docs.push(...page);

    if (page.length < pageSize) {
      break;
    }

    const nextBookmark = lastResult.bookmark;
    if (nextBookmark && nextBookmark !== bookmark) {
      bookmark = nextBookmark;
    } else {
      bookmark = undefined;
      skip = initialSkip + docs.length;
    }
  } while (true);

  return { ...lastResult, docs };
}

module.exports = {
  DEFAULT_PAGE_SIZE,
  findAll,
};
