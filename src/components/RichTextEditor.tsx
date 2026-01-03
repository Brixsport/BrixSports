'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
    Bold,
    Italic,
    List,
    ListOrdered,
    Quote,
    Undo,
    Redo,
    Link2,
    Image as ImageIcon,
    Heading1,
    Heading2,
    Code,
} from 'lucide-react';
import { useCallback } from 'react';

interface RichTextEditorProps {
    content: string;
    onChange: (content: string) => void;
    placeholder?: string;
}

export default function RichTextEditor({ content, onChange, placeholder = 'Start writing...' }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Image.configure({
                HTMLAttributes: {
                    class: 'rounded-lg max-w-full h-auto',
                },
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-cyan-400 hover:text-cyan-300 underline',
                },
            }),
            Placeholder.configure({
                placeholder,
            }),
        ],
        content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-invert max-w-none focus:outline-none min-h-[300px] px-4 py-3',
            },
        },
    });

    const addImage = useCallback(() => {
        const url = window.prompt('Enter image URL:');
        if (url && editor) {
            editor.chain().focus().setImage({ src: url }).run();
        }
    }, [editor]);

    const addLink = useCallback(() => {
        const url = window.prompt('Enter URL:');
        if (url && editor) {
            editor.chain().focus().setLink({ href: url }).run();
        }
    }, [editor]);

    if (!editor) {
        return null;
    }

    return (
        <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-800">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-700 bg-slate-800/50">
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    active={editor.isActive('bold')}
                    icon={<Bold className="w-4 h-4" />}
                    title="Bold"
                />
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    active={editor.isActive('italic')}
                    icon={<Italic className="w-4 h-4" />}
                    title="Italic"
                />
                <div className="w-px h-6 bg-slate-700 mx-1" />
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    active={editor.isActive('heading', { level: 1 })}
                    icon={<Heading1 className="w-4 h-4" />}
                    title="Heading 1"
                />
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    active={editor.isActive('heading', { level: 2 })}
                    icon={<Heading2 className="w-4 h-4" />}
                    title="Heading 2"
                />
                <div className="w-px h-6 bg-slate-700 mx-1" />
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    active={editor.isActive('bulletList')}
                    icon={<List className="w-4 h-4" />}
                    title="Bullet List"
                />
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    active={editor.isActive('orderedList')}
                    icon={<ListOrdered className="w-4 h-4" />}
                    title="Numbered List"
                />
                <div className="w-px h-6 bg-slate-700 mx-1" />
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    active={editor.isActive('blockquote')}
                    icon={<Quote className="w-4 h-4" />}
                    title="Quote"
                />
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    active={editor.isActive('codeBlock')}
                    icon={<Code className="w-4 h-4" />}
                    title="Code Block"
                />
                <div className="w-px h-6 bg-slate-700 mx-1" />
                <ToolbarButton
                    onClick={addLink}
                    active={editor.isActive('link')}
                    icon={<Link2 className="w-4 h-4" />}
                    title="Add Link"
                />
                <ToolbarButton
                    onClick={addImage}
                    icon={<ImageIcon className="w-4 h-4" />}
                    title="Add Image"
                />
                <div className="flex-1" />
                <ToolbarButton
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    icon={<Undo className="w-4 h-4" />}
                    title="Undo"
                />
                <ToolbarButton
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    icon={<Redo className="w-4 h-4" />}
                    title="Redo"
                />
            </div>

            {/* Editor */}
            <EditorContent editor={editor} />
        </div>
    );
}

function ToolbarButton({
    onClick,
    active = false,
    disabled = false,
    icon,
    title,
}: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    icon: React.ReactNode;
    title: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`p-2 rounded-lg transition-colors ${active
                    ? 'bg-cyan-500 text-white'
                    : disabled
                        ? 'text-slate-600 cursor-not-allowed'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
        >
            {icon}
        </button>
    );
}
