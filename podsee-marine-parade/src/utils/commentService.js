import { supabase, supabaseAdmin } from './supabaseClient';

/**
 * Sanitize text to prevent XSS attacks
 */
function sanitizeText(text) {
  if (!text) return '';
  
  // Remove HTML tags
  let sanitized = text.replace(/<[^>]*>/g, '');
  
  // Remove script tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Validate comment text for URLs
 */
function containsUrl(text) {
  const urlPatterns = [
    /https?:\/\//i,
    /www\./i,
    /\.[a-z]{2,}\//i,
    /\b[a-z0-9-]+\.(com|net|org|edu|gov|io|co|uk|us)\b/i
  ];
  
  return urlPatterns.some(pattern => pattern.test(text));
}

/**
 * Validate comment before submission
 */
function validateComment(text, username) {
  const errors = [];
  
  if (!text || text.trim().length === 0) {
    errors.push('Comment cannot be empty');
  }
  
  if (text && text.length > 500) {
    errors.push('Comment must be 500 characters or less');
  }
  
  if (containsUrl(text)) {
    errors.push('Comments cannot contain URLs or links');
  }
  
  if (!username || username.trim().length === 0) {
    errors.push('Username is required');
  }
  
  if (username && username.length > 50) {
    errors.push('Username must be 50 characters or less');
  }
  
  return errors;
}

/**
 * Fetch top-level comments for a centre with optional context filtering
 * @param {string} centreId - The centre ID
 * @param {number} limit - Number of comments to fetch
 * @param {number} offset - Offset for pagination
 * @param {string|null} level - Optional level filter (null for general comments)
 * @param {string|null} subject - Optional subject filter (null for general comments)
 */
export async function fetchComments(centreId, limit = 20, offset = 0, level = null, subject = null) {
  try {
    // If both level and subject are explicitly null or undefined, fetch general comments only
    // Otherwise, use context-aware RPC if available
    const useContextFilter = level !== undefined || subject !== undefined;

    if (useContextFilter) {
      // Try context-aware RPC first (if it exists in backend)
      const { data, error } = await supabase
        .rpc('get_comments_with_reply_count_by_context', {
          p_centre_id: centreId,
          p_level: level,
          p_subject: subject,
          p_limit: limit,
          p_offset: offset
        });

      if (error) {
        // Fallback to basic RPC if context-aware doesn't exist
        console.warn('Context-aware RPC not available, using basic fetch');
        return await fetchCommentsBasic(centreId, limit, offset);
      }

      return { data: data || [], error: null };
    } else {
      return await fetchCommentsBasic(centreId, limit, offset);
    }
  } catch (error) {
    console.error('Error fetching comments:', error);
    return { data: [], error: error.message };
  }
}

/**
 * Fetch top-level comments for a centre (basic, no filtering)
 */
async function fetchCommentsBasic(centreId, limit = 20, offset = 0) {
  try {
    const { data, error } = await supabase
      .rpc('get_comments_with_reply_count', {
        p_centre_id: centreId,
        p_limit: limit,
        p_offset: offset
      });

    if (error) throw error;

    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching comments:', error);
    return { data: [], error: error.message };
  }
}

/**
 * Fetch replies for a parent comment
 */
export async function fetchReplies(parentCommentId, limit = 2, offset = 0) {
  try {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('parent_comment_id', parentCommentId)
      .eq('hidden', false)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching replies:', error);
    return { data: [], error: error.message };
  }
}

/**
 * Get total reply count for a parent comment
 */
export async function getReplyCount(parentCommentId) {
  try {
    const { count, error } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('parent_comment_id', parentCommentId)
      .eq('hidden', false);
    
    if (error) throw error;
    
    return { count: count || 0, error: null };
  } catch (error) {
    console.error('Error getting reply count:', error);
    return { count: 0, error: error.message };
  }
}

/**
 * Create a new comment or reply
 * @param {string} centreId - The centre ID
 * @param {string} username - Username
 * @param {string} text - Comment text
 * @param {string|null} parentCommentId - Parent comment ID for replies
 * @param {string|null} level - Level (for top-level comments only, NULL for general)
 * @param {string|null} subject - Subject (for top-level comments only, NULL for general)
 */
export async function createComment(centreId, username, text, parentCommentId = null, level = null, subject = null) {
  try {
    // Sanitize inputs
    const sanitizedText = sanitizeText(text);
    const sanitizedUsername = sanitizeText(username);

    // Validate
    const errors = validateComment(sanitizedText, sanitizedUsername);
    if (errors.length > 0) {
      return { data: null, error: errors.join('. ') };
    }

    // Variables to store final level/subject
    let finalLevel = level;
    let finalSubject = subject;

    // If this is a reply, verify parent is a top-level comment and inherit its context
    if (parentCommentId) {
      const { data: parentComment, error: parentError } = await supabase
        .from('comments')
        .select('parent_comment_id, level, subject')
        .eq('comment_id', parentCommentId)
        .single();

      if (parentError) {
        return { data: null, error: 'Parent comment not found' };
      }

      if (parentComment.parent_comment_id !== null) {
        return { data: null, error: 'Cannot reply to a reply. Only top-level comments can be replied to.' };
      }

      // Inherit parent's level and subject for replies
      finalLevel = parentComment.level;
      finalSubject = parentComment.subject;
    }

    // Insert comment
    const { data, error } = await supabase
      .from('comments')
      .insert({
        centre_id: centreId,
        username: sanitizedUsername,
        text: sanitizedText,
        parent_comment_id: parentCommentId,
        level: finalLevel,
        subject: finalSubject,
        hidden: false
      })
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error creating comment:', error);
    return { data: null, error: error.message };
  }
}

/**
 * Admin: Fetch all comments (including hidden)
 */
export async function adminFetchAllComments() {
  try {
    const { data, error } = await supabaseAdmin
      .from('comments')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching all comments:', error);
    return { data: [], error: error.message };
  }
}

/**
 * Admin: Toggle comment visibility
 */
export async function adminToggleHidden(commentId, hidden) {
  try {
    const { data, error } = await supabaseAdmin
      .from('comments')
      .update({ hidden })
      .eq('comment_id', commentId)
      .select()
      .single();
    
    if (error) throw error;
    
    return { data, error: null };
  } catch (error) {
    console.error('Error toggling comment visibility:', error);
    return { data: null, error: error.message };
  }
}

/**
 * Admin: Delete comment
 */
export async function adminDeleteComment(commentId) {
  try {
    const { error } = await supabaseAdmin
      .from('comments')
      .delete()
      .eq('comment_id', commentId);
    
    if (error) throw error;
    
    return { error: null };
  } catch (error) {
    console.error('Error deleting comment:', error);
    return { error: error.message };
  }
}
